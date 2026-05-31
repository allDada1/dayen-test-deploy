import { sortProducts } from "../../../utils/product-query";
import type {
  ProductFilters,
  ProductPaging,
  ProductRow,
  ProductSort,
  ReviewPermission,
  createProductsRepository,
} from "../repositories/products.repository";

type ProductsRepository = ReturnType<typeof createProductsRepository>;

type ProductsServiceOptions = {
  repository: ProductsRepository;
  attachImagesToProducts: (rows: ProductRow[]) => Promise<ProductRow[]>;
  withProductStats: (
    rows: ProductRow[] | ProductRow,
    userId: number | null,
    callback: (rows: ProductRow[]) => unknown,
  ) => Promise<unknown>;
};

export function createProductsService({
  repository,
  attachImagesToProducts,
  withProductStats,
}: ProductsServiceOptions) {
  async function attachImages(rows: ProductRow[], logLabel: string) {
    try {
      return await attachImagesToProducts(rows);
    } catch (error) {
      console.error(`${logLabel} attachImagesToProducts error:`, error);
      return rows;
    }
  }

  async function getReviewPermission(productId: number, userId: number): Promise<ReviewPermission> {
    if (!productId || !userId) {
      return { can_review: false, reason: "auth_required", already_reviewed: false };
    }

    if (await repository.hasReview(productId, userId)) {
      return { can_review: false, reason: "already_reviewed", already_reviewed: true };
    }

    const deliveredOrder = await repository.findDeliveredOrderForReview(productId, userId);
    if (!deliveredOrder) {
      return { can_review: false, reason: "not_purchased", already_reviewed: false };
    }

    return {
      can_review: true,
      reason: null,
      already_reviewed: false,
      order_id: Number(deliveredOrder.id || 0),
    };
  }

  async function getRatingPermission(productId: number, userId: number): Promise<ReviewPermission> {
    if (!productId || !userId) {
      return { can_review: false, reason: "auth_required", already_reviewed: false };
    }

    if (await repository.hasReview(productId, userId)) {
      return { can_review: false, reason: "already_reviewed", already_reviewed: true };
    }

    if (await repository.hasRating(productId, userId)) {
      return { can_review: false, reason: "already_rated", already_reviewed: false };
    }

    const deliveredOrder = await repository.findDeliveredOrderForReview(productId, userId);
    if (!deliveredOrder) {
      return { can_review: false, reason: "not_purchased", already_reviewed: false };
    }

    return {
      can_review: true,
      reason: null,
      already_reviewed: false,
      order_id: Number(deliveredOrder.id || 0),
    };
  }

  return {
    async listProducts(filters: ProductFilters, sort: ProductSort, paging: ProductPaging, userId: number | null = null) {
      const needsPostStatsSort = sort.sort === "likes" || sort.sort === "rating";

      if (needsPostStatsSort) {
        const rows = await attachImages(
          await repository.findProductsForStatsSort(filters),
          "products",
        );

        return await withProductStats(rows, userId, (out) => {
          const prepared = sortProducts(out || [], sort.sort, sort.dir);
          if (!paging.enabled) return { items: prepared };

          const total = prepared.length;
          const items = prepared.slice(paging.offset, paging.offset + paging.limit);
          const has_more = paging.offset + items.length < total;
          return { items, total, limit: paging.limit, offset: paging.offset, has_more };
        });
      }

      const total = await repository.countProducts(filters);
      const rows = await attachImages(
        await repository.findProducts(filters, sort, paging),
        "products",
      );

      return await withProductStats(rows, userId, (out) => {
        const prepared = sortProducts(out || [], sort.sort, sort.dir);
        if (!paging.enabled) return { items: prepared };

        const has_more = paging.offset + prepared.length < total;
        return { items: prepared, total, limit: paging.limit, offset: paging.offset, has_more };
      });
    },

    async getProductById(productId: number, userId: number | null) {
      const row = await repository.findProductById(productId);
      if (!row) return null;

      const prepared = (await attachImages([row], "product"))[0] || row;
      return await withProductStats([prepared], userId, (out) => out[0] || null);
    },

    async toggleLike(productId: number, userId: number) {
      const exists = await repository.hasLike(productId, userId);
      let liked = false;

      if (exists) {
        await repository.removeLike(productId, userId);
      } else {
        await repository.addLike(productId, userId);
        liked = true;
      }

      return {
        liked,
        likes: await repository.countLikes(productId),
      };
    },

    async listFavorites(userId: number) {
      const rows = await repository.findFavorites(userId);
      return await withProductStats(rows, userId, (out) => ({ items: out }));
    },

    async rateProduct(productId: number, userId: number, rating: number) {
      const permission = await getRatingPermission(productId, userId);
      if (!permission.can_review) {
        return { permission, my_rating: null, rating_avg: 0, rating_count: 0 };
      }

      await repository.setRating(productId, userId, rating);
      const stats = await repository.getRatingStats(productId);

      return {
        permission,
        my_rating: rating,
        ...stats,
      };
    },

    async listReviews(productId: number) {
      return { items: await repository.findReviews(productId) };
    },

    getReviewPermission,
    getRatingPermission,

    async createReview(userId: number, productId: number, rating: number, comment: string) {
      const permission = await getReviewPermission(productId, userId);
      if (!permission.can_review) {
        return { permission, review: null };
      }

      const review = await repository.createReview(userId, productId, rating, comment);
      await repository.removeRating(productId, userId);
      return { permission, review };
    },
  };
}
