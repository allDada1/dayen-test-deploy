import { createOrdersController } from "../modules/orders/controllers/orders.controller";
import { createSellerRequestsRouter } from "../modules/sellers/controllers/seller-requests.controller";

function mockResponse() {
  const res: any = {
    body: null,
    statusCode: 200,
    json: jest.fn((body) => {
      res.body = body;
      return res;
    }),
    status: jest.fn((statusCode) => {
      res.statusCode = statusCode;
      return res;
    }),
  };

  return res;
}

describe("email verification backend guards", () => {
  test("blocks order creation for unverified users", async () => {
    const controller = createOrdersController({
      pool: {} as any,
      authRequired: jest.fn(),
    });
    const req = {
      body: {},
      user: { id: 7, email_verified: false },
    } as any;
    const res = mockResponse();

    await controller.createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: "email_not_verified" });
  });

  test("blocks seller applications for unverified users", async () => {
    const router = createSellerRequestsRouter({
      pool: {} as any,
      authRequired: jest.fn(),
    }) as any;
    const applyLayer = router.stack.find((layer: any) => layer.route?.path === "/seller/apply");
    const applyHandler = applyLayer.route.stack.at(-1).handle;
    const req = {
      body: {},
      user: { id: 7, email_verified: false },
    } as any;
    const res = mockResponse();

    await applyHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: "email_not_verified" });
  });
});
