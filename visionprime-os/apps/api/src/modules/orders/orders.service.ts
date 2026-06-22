import { NotFoundError } from "../../common/http-error";
import { toPaginationMeta } from "../audit/audit.service";
import { OrdersRepository } from "./orders.repository";
import { OrderDetail, PublicOrder, toPublicOrder } from "./orders.types";

export interface OrdersServiceDeps {
  ordersRepository: OrdersRepository;
}

export class OrdersService {
  constructor(private readonly deps: OrdersServiceDeps) {}

  async list(page: number, pageSize: number, customerId?: string) {
    const result = await this.deps.ordersRepository.list({ page, pageSize, customerId });
    return { rows: result.rows.map(toPublicOrder), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getById(id: string): Promise<PublicOrder> {
    const order = await this.deps.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    return toPublicOrder(order);
  }

  async getDetail(id: string): Promise<OrderDetail> {
    const order = await this.deps.ordersRepository.findById(id);
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    const [items, events] = await Promise.all([
      this.deps.ordersRepository.listItems(id),
      this.deps.ordersRepository.listEvents(id),
    ]);
    return { order: toPublicOrder(order), items, events };
  }
}
