import { HttpError, NotFoundError } from "../../common/http-error";
import { AuditService } from "../audit/audit.service";
import { toPaginationMeta } from "../audit/audit.service";
import { CustomersRepository } from "./customers.repository";
import { Customer360, Customer360OrderRow, PublicCustomer, toPublicCustomer } from "./customers.types";
import { CreateCustomerDto, UpdateCustomerDto } from "./customers.dto";

export interface CustomersServiceDeps {
  customersRepository: CustomersRepository;
  auditService: AuditService;
  /**
   * Injected rather than imported directly to avoid a circular dependency
   * between the customers and orders modules — orders.service already
   * depends on nothing here, but customers needs order history for the
   * Customer 360 view.
   */
  listOrdersByCustomer?: (customerId: string) => Promise<Customer360OrderRow[]>;
  /** Fires the `customer_created` automation trigger. Fire-and-forget —
   * never throws past create(). */
  onCustomerCreated?: (customer: PublicCustomer) => void | Promise<void>;
}

export interface ActorContext {
  userId: string;
  isSuperAdmin: boolean;
}

export class CustomersService {
  constructor(private readonly deps: CustomersServiceDeps) {}

  async list(page: number, pageSize: number) {
    const result = await this.deps.customersRepository.list({ page, pageSize });
    return { rows: result.rows.map(toPublicCustomer), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getById(id: string): Promise<PublicCustomer> {
    const customer = await this.deps.customersRepository.findById(id);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }
    return toPublicCustomer(customer);
  }

  async create(dto: CreateCustomerDto, actor: ActorContext): Promise<PublicCustomer> {
    // Never duplicate a customer if mobile/email matches an existing one.
    const existing = await this.deps.customersRepository.findByMatchPriority({
      mobile: dto.primaryMobile,
      email: dto.primaryEmail,
      wordpressUserId: dto.wordpressUserId,
      woocommerceCustomerId: dto.woocommerceCustomerId,
    });
    if (existing) {
      throw new HttpError(409, "VALIDATION_FAILED", "A customer with this mobile or email already exists.", {
        customerId: existing.id,
      });
    }

    const created = await this.deps.customersRepository.create({
      fullName: dto.fullName,
      primaryEmail: dto.primaryEmail,
      primaryMobile: dto.primaryMobile,
      wordpressUserId: dto.wordpressUserId,
      woocommerceCustomerId: dto.woocommerceCustomerId,
    });

    const publicCustomer = toPublicCustomer(created);
    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "customer.create",
      targetType: "customer",
      targetId: created.id,
      after: publicCustomer,
    });

    if (this.deps.onCustomerCreated) {
      try {
        await this.deps.onCustomerCreated(publicCustomer);
      } catch {
        // Trigger dispatch failures must never surface as a customer API error.
      }
    }

    return publicCustomer;
  }

  async update(id: string, dto: UpdateCustomerDto, actor: ActorContext): Promise<PublicCustomer> {
    const before = await this.deps.customersRepository.findById(id);
    if (!before) {
      throw new NotFoundError("Customer not found");
    }

    const updated = await this.deps.customersRepository.update(id, dto);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "customer.update",
      targetType: "customer",
      targetId: id,
      before: toPublicCustomer(before),
      after: toPublicCustomer(updated),
    });

    return toPublicCustomer(updated);
  }

  async softDelete(id: string, actor: ActorContext): Promise<void> {
    const target = await this.deps.customersRepository.findById(id);
    if (!target) {
      throw new NotFoundError("Customer not found");
    }

    await this.deps.customersRepository.softDelete(id);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "customer.delete",
      targetType: "customer",
      targetId: id,
      before: toPublicCustomer(target),
    });
  }

  async addNote(customerId: string, note: string, actor: ActorContext) {
    const customer = await this.deps.customersRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const created = await this.deps.customersRepository.addNote(customerId, note, actor.userId);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "customer.note.create",
      targetType: "customer",
      targetId: customerId,
      after: { noteId: created.id },
    });

    return created;
  }

  async addTag(customerId: string, tag: string, actor: ActorContext) {
    const customer = await this.deps.customersRepository.findById(customerId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const created = await this.deps.customersRepository.addTag(customerId, tag);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "customer.tag.update",
      targetType: "customer",
      targetId: customerId,
      after: { tag },
    });

    return created ?? (await this.deps.customersRepository.listTags(customerId)).find((t) => t.tag === tag) ?? null;
  }

  async merge(survivorCustomerId: string, mergedCustomerId: string, actor: ActorContext): Promise<PublicCustomer> {
    if (survivorCustomerId === mergedCustomerId) {
      throw new HttpError(400, "VALIDATION_FAILED", "Cannot merge a customer into itself.");
    }

    const survivor = await this.deps.customersRepository.findById(survivorCustomerId);
    if (!survivor) {
      throw new NotFoundError("Survivor customer not found");
    }
    const merged = await this.deps.customersRepository.findById(mergedCustomerId);
    if (!merged) {
      throw new NotFoundError("Customer to merge not found");
    }

    await this.deps.customersRepository.merge(survivorCustomerId, mergedCustomerId, actor.userId);

    await this.deps.auditService.recordAuditLog({
      actorId: actor.userId,
      action: "customer.merge",
      targetType: "customer",
      targetId: survivorCustomerId,
      before: { mergedCustomerId },
      after: { survivorCustomerId },
    });

    const refreshedSurvivor = await this.deps.customersRepository.findById(survivorCustomerId);
    return toPublicCustomer(refreshedSurvivor!);
  }

  async get360(id: string): Promise<Customer360> {
    const customer = await this.deps.customersRepository.findById(id);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const [notes, tags, identities, events, orders] = await Promise.all([
      this.deps.customersRepository.listNotes(id),
      this.deps.customersRepository.listTags(id),
      this.deps.customersRepository.listIdentities(id),
      this.deps.customersRepository.listEvents(id),
      this.deps.listOrdersByCustomer ? this.deps.listOrdersByCustomer(id) : Promise.resolve([]),
    ]);

    return { customer: toPublicCustomer(customer), notes, tags, identities, events, orders };
  }
}
