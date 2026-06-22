import { NotFoundError } from "../../common/http-error";
import { toPaginationMeta } from "../audit/audit.service";
import { ProductsRepository } from "./products.repository";
import { PublicProduct, toPublicProduct } from "./products.types";

export interface ProductsServiceDeps {
  productsRepository: ProductsRepository;
}

export class ProductsService {
  constructor(private readonly deps: ProductsServiceDeps) {}

  async list(page: number, pageSize: number) {
    const result = await this.deps.productsRepository.list({ page, pageSize });
    return { rows: result.rows.map(toPublicProduct), meta: toPaginationMeta(page, pageSize, result.totalItems) };
  }

  async getById(id: string): Promise<PublicProduct> {
    const product = await this.deps.productsRepository.findById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return toPublicProduct(product);
  }

  async listCategories() {
    return this.deps.productsRepository.listCategories();
  }
}
