import type { Pool } from "pg";

import {
  createAdminProductsRepository,
  type AdminProductCreateInput,
  type AdminProductInput,
} from "../repositories/admin-products.repository";

type SaveProductImages = (
  pool: Pool,
  productId: number,
  images: string[],
  coverImage: string,
) => Promise<unknown>;

type AdminProductsServiceOptions = {
  pool: Pool;
  saveProductImages: SaveProductImages;
};

export function normalizeSpecsPayload(rawSpecs: any, rawSpecsJson: any) {
  const normalize = (items: any[]) =>
    items
      .map((item) => {
        if (!item) return null;
        const key = String(item.key || item.label || item.name || "").trim();
        const value = String(item.value || "").trim();
        if (!key || !value) return null;
        return { key, value };
      })
      .filter(Boolean)
      .slice(0, 30);

  if (Array.isArray(rawSpecs)) {
    return normalize(rawSpecs);
  }

  if (typeof rawSpecsJson === "string" && rawSpecsJson.trim()) {
    try {
      const parsed = JSON.parse(rawSpecsJson);
      if (Array.isArray(parsed)) return normalize(parsed);
    } catch {
      return null;
    }
  }

  return [];
}

export function createAdminProductsService({ pool, saveProductImages }: AdminProductsServiceOptions) {
  const repository = createAdminProductsRepository(pool);

  async function saveImages(productId: number, images: string[], coverImage: string) {
    try {
      await saveProductImages(pool, productId, images, coverImage || "");
    } catch (error) {
      console.error("save product images failed", error);
    }
  }

  return {
    async createProduct(input: AdminProductCreateInput, images: string[]) {
      const productId = await repository.createProduct(input);
      await saveImages(productId, images, input.imageUrl);
      return productId;
    },

    async updateProduct(productId: number, input: AdminProductInput, images: string[]) {
      const updated = await repository.updateProduct(productId, input);
      if (!updated) return false;

      await saveImages(productId, images, input.imageUrl);
      return true;
    },

    async deleteProduct(productId: number) {
      const deleted = await repository.deleteProduct(productId);
      if (!deleted) return false;

      await repository.deleteProductImages(productId);
      return true;
    },

    async notifyFollowers(sellerUserId: number | undefined, sellerDisplay: string, productTitle: string, productId: number) {
      try {
        await repository.notifySellerFollowers(
          sellerUserId,
          `Новый товар у продавца ${sellerDisplay}`,
          productTitle,
          `product.html?id=${productId}`,
        );
      } catch (error) {
        console.error("create notifications for followers failed", error);
      }
    },
  };
}
