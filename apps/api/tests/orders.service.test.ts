import {
  createOrder,
  hasElevatedOrderAccess,
  listMyOrders,
  queryAccessibleOrder,
  summarizeSellerSales,
} from "../modules/orders/services/orders.service";

describe("orders service", () => {
  test("summarizeSellerSales counts pending and paid as new", () => {
    expect(
      summarizeSellerSales([
        { status: "pending" },
        { status: "paid" },
        { status: "delivered" },
      ]),
    ).toEqual({
      total_count: 3,
      new_count: 2,
    });
  });

  test("createOrder returns empty_items when payload has no items", async () => {
    const pool = {} as any;

    await expect(createOrder(pool, 5, { items: [] })).resolves.toEqual({
      error: {
        status: 400,
        body: { error: "empty_items" },
      },
    });
  });

  test("createOrder rolls back when stock changes before decrement", async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ id: 100 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    };
    const pool = {
      query: jest.fn().mockResolvedValueOnce({
        rows: [{ id: 1, title: "Product", price: 500, stock: 1 }],
      }),
      connect: jest.fn().mockResolvedValueOnce(client),
    };

    await expect(
      createOrder(pool as any, 5, {
        items: [{ product_id: 1, qty: 1 }],
        delivery: {
          method: "courier",
          city: "Almaty",
          address: "Street 1",
          phone: "+77000000000",
          price: 0,
        },
      }),
    ).resolves.toEqual({
      error: {
        status: 400,
        body: { error: "not_enough_stock", product_id: 1 },
      },
    });

    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  test("listMyOrders adds mixed display status when seller statuses differ", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            { id: 10, user_id: 5, status: "created" },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            { order_id: 10, seller_status: "pending" },
            { order_id: 10, seller_status: "paid" },
          ],
          rowCount: 2,
        }),
    };

    await expect(listMyOrders(pool as any, 5)).resolves.toEqual([
      expect.objectContaining({
        id: 10,
        display_status: "mixed",
      }),
    ]);
  });

  test("admin without 2FA can only access own orders through user endpoints", async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }),
    };

    await expect(
      queryAccessibleOrder(
        pool as any,
        10,
        { id: 2, is_admin: true, is_owner: false, two_factor_enabled: false },
        "id",
      ),
    ).resolves.toBeNull();

    expect(pool.query).toHaveBeenCalledWith(
      "SELECT id FROM orders WHERE id = $1 AND user_id = $2",
      [10, 2],
    );
    expect(hasElevatedOrderAccess({ is_admin: true, is_owner: false, two_factor_enabled: false })).toBe(false);
  });

  test("admin with 2FA gets elevated order access", async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 10 }], rowCount: 1 }),
    };

    await expect(
      queryAccessibleOrder(
        pool as any,
        10,
        { id: 2, is_admin: true, is_owner: false, two_factor_enabled: true },
        "id",
      ),
    ).resolves.toEqual({ id: 10 });

    expect(pool.query).toHaveBeenCalledWith(
      "SELECT id FROM orders WHERE id = $1",
      [10],
    );
    expect(hasElevatedOrderAccess({ is_admin: true, is_owner: false, two_factor_enabled: true })).toBe(true);
  });
});
