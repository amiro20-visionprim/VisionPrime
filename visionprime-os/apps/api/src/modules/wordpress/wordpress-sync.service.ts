import { decryptSecret } from "../../common/crypto";
import { HttpError } from "../../common/http-error";
import { CustomersRepository } from "../customers/customers.repository";
import { ProductsRepository } from "../products/products.repository";
import {
  WordPressConnectionRepository,
  WordPressEntityMappingRepository,
  WordPressSyncJobRepository,
  WordPressSyncLogRepository,
} from "./wordpress.repository";
import { SyncCounts, WordPressSyncJobRow } from "./wordpress.types";
import { WooCommerceApiClient } from "./wordpress-sync.types";

export interface WordPressSyncServiceDeps {
  connectionRepository: WordPressConnectionRepository;
  syncJobRepository: WordPressSyncJobRepository;
  syncLogRepository: WordPressSyncLogRepository;
  entityMappingRepository: WordPressEntityMappingRepository;
  customersRepository: CustomersRepository;
  productsRepository: ProductsRepository;
  wooCommerceClient: WooCommerceApiClient;
  encryptionKey: string;
}

function emptyCounts(): SyncCounts {
  return { created: 0, updated: 0, failed: 0, total: 0 };
}

export class WordPressSyncService {
  constructor(private readonly deps: WordPressSyncServiceDeps) {}

  private async getDecryptedCredentials() {
    const connection = await this.deps.connectionRepository.get();
    if (!connection.site_url || !connection.consumer_key_encrypted || !connection.consumer_secret_encrypted) {
      throw new HttpError(
        400,
        "WORDPRESS_NOT_CONNECTED",
        "A WooCommerce site URL and credentials must be saved before syncing.",
      );
    }
    return {
      siteUrl: connection.site_url,
      consumerKey: decryptSecret(connection.consumer_key_encrypted, this.deps.encryptionKey),
      consumerSecret: decryptSecret(connection.consumer_secret_encrypted, this.deps.encryptionKey),
    };
  }

  private async finishJob(job: WordPressSyncJobRow, counts: SyncCounts): Promise<WordPressSyncJobRow> {
    const status = counts.total > 0 && counts.failed === counts.total ? "failed" : "succeeded";
    return this.deps.syncJobRepository.updateStatus(job.id, {
      status,
      finishedAt: new Date().toISOString(),
      metadata: { ...counts },
    });
  }

  async syncCustomers(actorId: string): Promise<{ job: WordPressSyncJobRow; counts: SyncCounts }> {
    const job = await this.deps.syncJobRepository.create("customer_sync");
    const counts = emptyCounts();

    let remoteCustomers: Array<{ id: string; email?: string | null; billing?: { phone?: string | null }; first_name?: string; last_name?: string }>;
    try {
      const { siteUrl, consumerKey, consumerSecret } = await this.getDecryptedCredentials();
      remoteCustomers = await this.deps.wooCommerceClient.fetchCustomers(siteUrl, consumerKey, consumerSecret);
    } catch (err) {
      await this.deps.syncLogRepository.insert({
        sync_job_id: job.id,
        level: "error",
        message: "Unable to reach the WooCommerce site to fetch customers.",
      });
      const finished = await this.finishJob(job, counts);
      return { job: finished, counts };
    }

    counts.total = remoteCustomers.length;

    for (const remote of remoteCustomers) {
      try {
        const fullName = [remote.first_name, remote.last_name].filter(Boolean).join(" ") || remote.email || `Customer ${remote.id}`;
        const mobile = remote.billing?.phone ?? null;
        const email = remote.email ?? null;

        const existing = await this.deps.customersRepository.findByMatchPriority({
          mobile,
          email,
          woocommerceCustomerId: remote.id,
        });

        let localId: string;
        if (existing) {
          await this.deps.customersRepository.update(existing.id, {
            fullName,
            primaryEmail: email ?? undefined,
            primaryMobile: mobile ?? undefined,
            woocommerceCustomerId: remote.id,
          });
          localId = existing.id;
          counts.updated += 1;
        } else {
          const created = await this.deps.customersRepository.create({
            fullName,
            primaryEmail: email,
            primaryMobile: mobile,
            woocommerceCustomerId: remote.id,
          });
          localId = created.id;
          counts.created += 1;
        }

        await this.deps.entityMappingRepository.upsert("customer", localId, String(remote.id));
      } catch {
        counts.failed += 1;
        await this.deps.syncLogRepository.insert({
          sync_job_id: job.id,
          level: "error",
          message: `Failed to sync customer record (remote id ${remote.id}).`,
        });
      }
    }

    const finished = await this.finishJob(job, counts);
    return { job: finished, counts };
  }

  async syncProducts(actorId: string): Promise<{ job: WordPressSyncJobRow; counts: SyncCounts }> {
    const job = await this.deps.syncJobRepository.create("product_sync");
    const counts = emptyCounts();

    let remoteCategories: Array<{ id: string; name: string; slug: string; parent?: string | number | null }> = [];
    let remoteProducts: Array<{ id: string; sku?: string | null; name: string; status?: string; price?: string | null; categories?: Array<{ id: string }> }>;
    try {
      const { siteUrl, consumerKey, consumerSecret } = await this.getDecryptedCredentials();
      remoteCategories = await this.deps.wooCommerceClient.fetchCategories(siteUrl, consumerKey, consumerSecret);
      remoteProducts = await this.deps.wooCommerceClient.fetchProducts(siteUrl, consumerKey, consumerSecret);
    } catch {
      await this.deps.syncLogRepository.insert({
        sync_job_id: job.id,
        level: "error",
        message: "Unable to reach the WooCommerce site to fetch products.",
      });
      const finished = await this.finishJob(job, counts);
      return { job: finished, counts };
    }

    for (const category of remoteCategories) {
      try {
        await this.deps.productsRepository.upsertCategory({
          name: category.name,
          slug: category.slug,
          woocommerceCategoryId: String(category.id),
          parentWoocommerceCategoryId: category.parent ? String(category.parent) : null,
        });
      } catch {
        // Category sync failures don't block product sync below.
      }
    }

    counts.total = remoteProducts.length;

    for (const remote of remoteProducts) {
      try {
        const { row, created } = await this.deps.productsRepository.upsert({
          woocommerceProductId: String(remote.id),
          sku: remote.sku ?? null,
          name: remote.name,
          status: remote.status ?? "active",
          price: remote.price ?? null,
          categoryWoocommerceIds: (remote.categories ?? []).map((c) => String(c.id)),
          raw: remote as Record<string, unknown>,
        });
        await this.deps.entityMappingRepository.upsert("product", row.id, String(remote.id));
        if (created) {
          counts.created += 1;
        } else {
          counts.updated += 1;
        }
      } catch {
        counts.failed += 1;
        await this.deps.syncLogRepository.insert({
          sync_job_id: job.id,
          level: "error",
          message: `Failed to sync product record (remote id ${remote.id}).`,
        });
      }
    }

    const finished = await this.finishJob(job, counts);
    return { job: finished, counts };
  }

  /**
   * Phase 05 incremental sync is a minimal composition of the full
   * customer + product syncs — true since-timestamp incremental sync is
   * out of scope this phase (see docs/phase-05-customer-product-sync.md).
   */
  async syncIncremental(actorId: string) {
    const customers = await this.syncCustomers(actorId);
    const products = await this.syncProducts(actorId);
    return { customers, products };
  }
}
