import type { Pool } from "pg";

import { parseOptionalString } from "../../../utils/validation";
import {
  createSellerProductsRepository,
  type SellerProductInput,
  type SellerProductListFilters,
} from "../repositories/seller-products.repository";

type SaveProductImages = (
  pool: Pool,
  productId: number,
  images: string[],
  coverImage: string,
) => Promise<unknown>;

type SellerProductsServiceOptions = {
  pool: Pool;
  saveProductImages: SaveProductImages;
};

export type SellerProductPayload = SellerProductInput & {
  images: string[];
};

export function parseProductSpecs(raw: any, { allowMissing = false } = {}) {
  if (raw == null) return allowMissing ? null : [];
  if (!Array.isArray(raw)) return null;

  return raw
    .map((item) => {
      const key = parseOptionalString(item?.key, { max: 120, normalize: true });
      const value = parseOptionalString(item?.value, { max: 500, normalize: true });
      if (key == null || value == null) return null;
      if (!key || !value) return null;
      return { key, value };
    })
    .filter(Boolean)
    .slice(0, 30);
}

export function normalizeSellerProductSort(value: unknown): SellerProductListFilters["sort"] {
  const sort = String(value || "new").trim().toLowerCase();
  if (sort === "old") return "old";
  if (sort === "price_asc") return "price_asc";
  if (sort === "price_desc") return "price_desc";
  if (sort === "stock_asc") return "stock_asc";
  if (sort === "stock_desc") return "stock_desc";
  return "new";
}

export function createSellerProductsService({ pool, saveProductImages }: SellerProductsServiceOptions) {
  const repository = createSellerProductsRepository(pool);

  async function persistProductImages(productId: number, images: string[], coverImage: string, label: string) {
    try {
      await saveProductImages(pool, productId, images, coverImage);
    } catch (error) {
      console.error(label, error);
    }
  }

  return {
    async buildSellerAccessError(userId: number) {
      const row = await repository.getSellerAccess(userId);
      return {
        error: "seller_only",
        message: "Доступ продавца сейчас отключен.",
        admin_comment: row?.admin_comment || "",
        seller_status: row?.status || "inactive",
        reviewed_at: row?.reviewed_at || null,
      };
    },

    async listProducts(ownerUserId: number, filters: SellerProductListFilters) {
      const [products, total, tiles] = await Promise.all([
        repository.listProducts(ownerUserId, filters),
        repository.countProducts(ownerUserId, filters),
        repository.listTiles(ownerUserId),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / filters.limit));
      const page = Math.floor(filters.offset / filters.limit) + 1;

      return {
        products,
        total,
        limit: filters.limit,
        offset: filters.offset,
        page,
        total_pages: totalPages,
        has_prev: filters.offset > 0,
        has_next: filters.offset + products.length < total,
        tiles,
      };
    },

    async createProduct(ownerUserId: number, payload: SellerProductPayload) {
      const id = await repository.createProduct(ownerUserId, payload);
      await persistProductImages(id, payload.images, payload.coverImage, "save seller product images failed");
      return id;
    },

    async updateProduct(ownerUserId: number, productId: number, payload: SellerProductPayload) {
      const updated = await repository.updateProduct(ownerUserId, productId, payload);
      if (!updated) return false;

      await persistProductImages(productId, payload.images, payload.coverImage, "update seller product images failed");
      return true;
    },

    async deleteProduct(ownerUserId: number, productId: number) {
      const deleted = await repository.deleteProduct(ownerUserId, productId);
      if (!deleted) return false;

      await repository.deleteProductImages(productId);
      return true;
    },
  };
}
