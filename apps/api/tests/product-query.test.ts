import { normalizeSort, sortProducts, toPositiveInt } from "../utils/product-query";

describe("product query utils", () => {
  test("normalizeSort falls back to new/desc", () => {
    expect(normalizeSort("unknown", "weird")).toEqual({ sort: "new", dir: "desc" });
  });

  test("sortProducts sorts by price ascending", () => {
    const products = [
      { id: 1, price: 30 },
      { id: 2, price: 10 },
      { id: 3, price: 20 },
    ];

    expect(sortProducts(products, "price", "asc").map((item) => item.id)).toEqual([2, 3, 1]);
  });

  test("sortProducts sorts by rating with rating count tie-breaker", () => {
    const products = [
      { id: 1, rating_avg: 4.5, rating_count: 2 },
      { id: 2, rating_avg: 4.5, rating_count: 10 },
      { id: 3, rating_avg: 4.8, rating_count: 1 },
    ];

    expect(sortProducts(products, "rating", "desc").map((item) => item.id)).toEqual([3, 2, 1]);
  });

  test("toPositiveInt returns floored fallback-aware numbers", () => {
    expect(toPositiveInt("12.9")).toBe(12);
    expect(toPositiveInt("-1", 7)).toBe(7);
  });
});
