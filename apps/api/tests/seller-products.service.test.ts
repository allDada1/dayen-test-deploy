import { createSellerProductsService } from "../modules/sellers/services/seller-products.service";

describe("seller products service", () => {
  test("does not delete product images when seller does not own product", async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };
    const service = createSellerProductsService({
      pool: pool as any,
      saveProductImages: jest.fn(),
    });

    await expect(service.deleteProduct(5, 100)).resolves.toBe(false);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM products"),
      [100, 5],
    );
    expect(pool.query).not.toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM product_images"),
      expect.anything(),
    );
  });

  test("deletes product images only after ownership check passes", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 100 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }),
    };
    const service = createSellerProductsService({
      pool: pool as any,
      saveProductImages: jest.fn(),
    });

    await expect(service.deleteProduct(5, 100)).resolves.toBe(true);

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("DELETE FROM products"),
      [100, 5],
    );
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DELETE FROM product_images"),
      [100],
    );
  });
});
