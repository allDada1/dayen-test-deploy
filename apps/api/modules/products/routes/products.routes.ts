import express from "express";
import type { Pool } from "pg";

import { createProductsController } from "../controllers/products.controller";
import type { ProductRow } from "../repositories/products.repository";

type ProductsRouterOptions = {
  pool: Pool;
  attachImagesToProducts: (rows: ProductRow[]) => Promise<ProductRow[]>;
  withProductStats: (
    rows: ProductRow[] | ProductRow,
    userId: number | null,
    callback: (rows: ProductRow[]) => unknown,
  ) => Promise<unknown>;
};

export function createProductsRouter(options: ProductsRouterOptions) {
  const router = express.Router();
  const controller = createProductsController(options);

  router.get("/products", controller.listProducts);
  router.get("/products/:id", controller.getProduct);

  return router;
}
