import { decryptSecret } from "../../common/crypto";
import { HttpError } from "../../common/http-error";
import { CustomersRepository } from "../customers/customers.repository";
import { ProductsRepository } from "../products/products.repository";
import { OrdersRepository } from "../orders/orders.repository";
import { METRIC_NEGATIVE_STATUSES, METRIC_POSITIVE_STATUSES, OrderRow } from "../orders/orders.types";
import {
  WordPressConnectionRepository,
  WordPressEntityMappingRepository,
  WordPressSyncJobRepository,
  WordPressSyncLogRepository,
} from "./wordpress.repository";
import { SyncCounts, WordPressSyncJobRow } from "./wordpress.types";
import { RemoteWooCommerceOrder, WooCommerceApiClient } from "./wordpress-sync.types";

export interface WordPressSyncServiceDeps {
  connectionRepository: WordPressConnectionRepository;
  syncJobRepository: WordPressSyncJobRepository;
  syncLogRepository: WordPressSyncLogRepository;
  entityMappingRepository: WordPressEntityMappingRepository;
  customersRepository: CustomersRepository;
  productsRepository: ProductsRepository;
  ordersRepository: OrdersRepository;
  wooCommerceClient: WooCommerceApiClient;
  encryptionKey: string;
  /** Wallet cashback hooks — injected as closures (rather than importing
   * the wallet module directly) to avoid a circular module dependency. */
  applyCashbackForOrder?: (params: {
    customerId: string;
    woocommerceOrderId: string;
    orderTotalMajorUnits: number;
    currency?: string;
  }) => Promise<unknown>;
  reverseCashbackForOrder?: (woocommerceOrderId: string) => Promise<unknown>;
  /** Loyalty points hooks — same closure-injection pattern as the cashback hooks above. */
  applyPointsForOrder?: (params: {
    customerId: string;
    woocommerceOrderId: string;
    orderTotalMajorUnits: number;
    currency?: string;
  }) => Promise<unknown>;
  reversePointsForOrder?: (woocommerceOrderId: string) => Promise<unknown>;
  /** Fires order-status-change automation triggers (order_completed/
   * order_cancelled/order_refunded/woocommerce_order_status_changed —
   * the automations module inspects the specific status to decide which
   * trigger(s) fired). Fire-and-forget, never throws past sync. */
  onOrderStatusChanged?: (params: {
    customerId: string;
    woocommerceOrderId: string;
    previousStatus: string | null;
    newStatus: string;
  }) => void | Promise<void>;
}

/** "positive" = counts toward purchase metrics, "negative" = reverses a prior positive effect, "none" = no effect. */
function metricEffect(status: string): "positive" | "negative" | "none" {
  if (METRIC_POSITIVE_STATUSES.includes(status)) return "positive";
  if (METRIC_NEGATIVE_STATUSES.includes(status)) return "negative";
  return "none";
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

  async syncOrders(actorId: string): Promise<{ job: WordPressSyncJobRow; counts: SyncCounts }> {
    const job = await this.deps.syncJobRepository.create("order_sync");
    const counts = emptyCounts();

    let remoteOrders: RemoteWooCommerceOrder[];
    try {
      const { siteUrl, consumerKey, consumerSecret } = await this.getDecryptedCredentials();
      remoteOrders = await this.deps.wooCommerceClient.fetchOrders(siteUrl, consumerKey, consumerSecret);
    } catch {
      await this.deps.syncLogRepository.insert({
        sync_job_id: job.id,
        level: "error",
        message: "Unable to reach the WooCommerce site to fetch orders.",
      });
      const finished = await this.finishJob(job, counts);
      return { job: finished, counts };
    }

    counts.total = remoteOrders.length;

    for (const remote of remoteOrders) {
      try {
        const { created } = await this.upsertOrderFromRemote(remote);
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
          message: `Failed to sync order record (remote id ${remote.id}).`,
        });
      }
    }

    const finished = await this.finishJob(job, counts);
    return { job: finished, counts };
  }

  /**
   * Resolves/creates the owning customer, upserts the order + its items
   * (idempotent on woocommerce_order_id, keyed via OrdersRepository.upsert),
   * records the entity mapping, applies the customer purchase-metrics
   * delta for the resulting status transition, and writes an order_events
   * row. Shared by both the manual/scheduled sync loop above and the
   * webhook receiver below — retry-safe by construction, since re-running
   * it with the same remote payload always converges to the same end
   * state (no double-counted metrics on redelivery).
   */
  async upsertOrderFromRemote(remote: RemoteWooCommerceOrder): Promise<{ row: OrderRow; created: boolean }> {
    const email = remote.billing?.email ?? null;
    const mobile = remote.billing?.phone ?? null;
    const woocommerceCustomerId = remote.customer_id ? String(remote.customer_id) : null;

    let customer = await this.deps.customersRepository.findByMatchPriority({
      mobile,
      email,
      woocommerceCustomerId,
    });
    if (!customer) {
      const fullName =
        [remote.billing?.first_name, remote.billing?.last_name].filter(Boolean).join(" ") ||
        email ||
        `Customer (order ${remote.id})`;
      customer = await this.deps.customersRepository.create({
        fullName,
        primaryEmail: email,
        primaryMobile: mobile,
        woocommerceCustomerId,
      });
    }

    const items = (remote.line_items ?? []).map((item) => ({
      woocommerceProductId: item.product_id != null ? String(item.product_id) : null,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price ?? 0),
      total: Number(item.total),
      raw: item as unknown as Record<string, unknown>,
    }));

    const { row, created, previousStatus } = await this.deps.ordersRepository.upsert({
      customerId: customer.id,
      woocommerceOrderId: String(remote.id),
      status: remote.status,
      currency: remote.currency ?? null,
      total: Number(remote.total),
      raw: remote as unknown as Record<string, unknown>,
      orderedAt: remote.date_created ?? null,
      items,
    });

    await this.deps.entityMappingRepository.upsert("order", row.id, String(remote.id));

    const previousEffect = previousStatus ? metricEffect(previousStatus) : "none";
    const newEffect = metricEffect(remote.status);
    if (previousEffect !== newEffect) {
      if (previousEffect === "positive") {
        await this.deps.customersRepository.applyPurchaseMetricsDelta(customer.id, {
          purchaseCountDelta: -1,
          totalSpentDelta: -Number(row.total),
        });
      }
      if (newEffect === "positive") {
        await this.deps.customersRepository.applyPurchaseMetricsDelta(customer.id, {
          purchaseCountDelta: 1,
          totalSpentDelta: Number(row.total),
          lastPurchaseAt: row.ordered_at ?? new Date().toISOString(),
        });
        if (this.deps.applyCashbackForOrder) {
          await this.deps.applyCashbackForOrder({
            customerId: customer.id,
            woocommerceOrderId: String(remote.id),
            orderTotalMajorUnits: Number(row.total),
            currency: remote.currency ?? undefined,
          });
        }
        if (this.deps.applyPointsForOrder) {
          await this.deps.applyPointsForOrder({
            customerId: customer.id,
            woocommerceOrderId: String(remote.id),
            orderTotalMajorUnits: Number(row.total),
            currency: remote.currency ?? undefined,
          });
        }
      }
      if (previousEffect === "positive" && newEffect !== "positive" && this.deps.reverseCashbackForOrder) {
        await this.deps.reverseCashbackForOrder(String(remote.id));
      }
      if (previousEffect === "positive" && newEffect !== "positive" && this.deps.reversePointsForOrder) {
        await this.deps.reversePointsForOrder(String(remote.id));
      }
    }

    await this.deps.ordersRepository.recordEvent(row.id, created ? "order.created" : "order.updated", {
      status: remote.status,
      previousStatus,
    });

    if (previousStatus !== remote.status && this.deps.onOrderStatusChanged) {
      try {
        await this.deps.onOrderStatusChanged({
          customerId: customer.id,
          woocommerceOrderId: String(remote.id),
          previousStatus,
          newStatus: remote.status,
        });
      } catch {
        // Trigger dispatch failures must never surface as a sync error.
      }
    }

    return { row, created };
  }

  /**
   * Handles the order-deleted webhook. Reverses any previously-applied
   * positive purchase-metrics effect, sets status to "deleted", and
   * records an order_events row. No-op (returns null) if this order was
   * never synced locally — nothing to delete, and retry-safe either way.
   */
  async markOrderDeleted(woocommerceOrderId: string): Promise<OrderRow | null> {
    const result = await this.deps.ordersRepository.updateStatusByWoocommerceOrderId(woocommerceOrderId, "deleted");
    if (!result) {
      return null;
    }
    const { row, previousStatus } = result;

    if (metricEffect(previousStatus) === "positive") {
      await this.deps.customersRepository.applyPurchaseMetricsDelta(row.customer_id, {
        purchaseCountDelta: -1,
        totalSpentDelta: -Number(row.total),
      });
      if (this.deps.reverseCashbackForOrder) {
        await this.deps.reverseCashbackForOrder(woocommerceOrderId);
      }
      if (this.deps.reversePointsForOrder) {
        await this.deps.reversePointsForOrder(woocommerceOrderId);
      }
    }

    await this.deps.ordersRepository.recordEvent(row.id, "order.deleted", { previousStatus });
    return row;
  }

  /**
   * Phase 05 incremental sync is a minimal composition of the full
   * customer + product syncs — true since-timestamp incremental sync is
   * out of scope this phase (see docs/phase-05-customer-product-sync.md).
   * Phase 06 adds orders to the composition.
   */
  async syncIncremental(actorId: string) {
    const customers = await this.syncCustomers(actorId);
    const products = await this.syncProducts(actorId);
    const orders = await this.syncOrders(actorId);
    return { customers, products, orders };
  }
}
