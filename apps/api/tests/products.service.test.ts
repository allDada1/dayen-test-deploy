import { createProductsService } from "../modules/products/services/products.service";

function makeService(repository: Record<string, jest.Mock>) {
  return createProductsService({
    repository: repository as any,
    attachImagesToProducts: async (rows) => rows,
    withProductStats: async (rows, _userId, callback) => callback(Array.isArray(rows) ? rows : [rows]),
  });
}

describe("products service", () => {
  test("does not allow rating a product without a delivered order", async () => {
    const repository = {
      hasReview: jest.fn().mockResolvedValue(false),
      hasRating: jest.fn().mockResolvedValue(false),
      findDeliveredOrderForReview: jest.fn().mockResolvedValue(null),
      setRating: jest.fn(),
      getRatingStats: jest.fn(),
    };
    const service = makeService(repository);

    await expect(service.rateProduct(10, 5, 4)).resolves.toEqual({
      permission: { can_review: false, reason: "not_purchased", already_reviewed: false },
      my_rating: null,
      rating_avg: 0,
      rating_count: 0,
    });

    expect(repository.setRating).not.toHaveBeenCalled();
  });

  test("allows product rating after a delivered order", async () => {
    const repository = {
      hasReview: jest.fn().mockResolvedValue(false),
      hasRating: jest.fn().mockResolvedValue(false),
      findDeliveredOrderForReview: jest.fn().mockResolvedValue({ id: 77 }),
      setRating: jest.fn().mockResolvedValue(undefined),
      getRatingStats: jest.fn().mockResolvedValue({ rating_avg: 4.5, rating_count: 2 }),
    };
    const service = makeService(repository);

    await expect(service.rateProduct(10, 5, 4)).resolves.toEqual({
      permission: { can_review: true, reason: null, already_reviewed: false, order_id: 77 },
      my_rating: 4,
      rating_avg: 4.5,
      rating_count: 2,
    });

    expect(repository.setRating).toHaveBeenCalledWith(10, 5, 4);
  });

  test("removes old standalone rating after creating a review", async () => {
    const repository = {
      hasReview: jest.fn().mockResolvedValue(false),
      findDeliveredOrderForReview: jest.fn().mockResolvedValue({ id: 77 }),
      createReview: jest.fn().mockResolvedValue({ id: 1, rating: 5 }),
      removeRating: jest.fn().mockResolvedValue(undefined),
    };
    const service = makeService(repository);

    await expect(service.createReview(5, 10, 5, "Good")).resolves.toEqual({
      permission: { can_review: true, reason: null, already_reviewed: false, order_id: 77 },
      review: { id: 1, rating: 5 },
    });

    expect(repository.removeRating).toHaveBeenCalledWith(10, 5);
  });
});
