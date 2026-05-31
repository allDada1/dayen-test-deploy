import type { Pool } from "pg";

import {
  createAdminCategoriesRepository,
  type CategoryCreateInput,
  type CategoryOrderInput,
  type CategoryUpdateInput,
} from "../repositories/admin-categories.repository";

export function isUniqueError(error: unknown) {
  const msg = String((error as { message?: string })?.message || error).toLowerCase();
  return msg.includes("unique") || msg.includes("duplicate key");
}

export function parseSortOrder(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseActiveFlag(value: unknown, fallback = 1) {
  if (value === undefined) return fallback;
  return value ? 1 : 0;
}

export function createAdminCategoriesService(pool: Pool) {
  const repository = createAdminCategoriesRepository(pool);

  return {
    listCategories: repository.listCategories,
    isSlugAvailable: repository.isSlugAvailable,
    createCategory(input: CategoryCreateInput) {
      return repository.createCategory(input);
    },
    updateCategory(id: number, input: CategoryUpdateInput) {
      return repository.updateCategory(id, input);
    },
    reorderCategories(orders: CategoryOrderInput[]) {
      return repository.reorderCategories(orders);
    },
    deleteCategory(id: number) {
      return repository.deleteCategory(id);
    },
  };
}
