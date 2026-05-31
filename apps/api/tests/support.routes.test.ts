import { createSupportRouter } from "../modules/support/routes/support.routes";

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

function supportSubmitHandler(pool: any) {
  const router = createSupportRouter({
    pool,
    optionalAuth: jest.fn(),
    authRequired: jest.fn(),
    adminRequired: jest.fn(),
  }) as any;
  const layer = router.stack.find((item: any) => item.route?.path === "/support/tickets");
  return layer.route.stack.at(-1).handle;
}

describe("support tickets", () => {
  test("creates ticket and links authenticated user when available", async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 42, status: "new", created_at: "2026-05-01T00:00:00.000Z" }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const handler = supportSubmitHandler(pool);
    const message = "Кнопка на странице не работает после отправки формы.";
    const req = {
      body: {
        email: "user@gmail.com",
        category: "site",
        page_url: "/about/report",
        image_url: "/uploads/support/screen.png",
        image_urls: ["/uploads/support/screen.png", "/uploads/support/second.png"],
        message,
      },
      user: { id: 7, email: "user@gmail.com" },
    } as any;
    const res = mockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.ticket.id).toBe(42);
    expect(pool.query).toHaveBeenNthCalledWith(4, expect.stringContaining("INSERT INTO support_tickets"), [
      7,
      "user@gmail.com",
      "site",
      "/about/report",
      "/uploads/support/screen.png",
      JSON.stringify(["/uploads/support/screen.png", "/uploads/support/second.png"]),
      message,
    ]);
    expect(pool.query).toHaveBeenNthCalledWith(5, expect.stringContaining("INSERT INTO notifications"), [
      "Новый тикет поддержки #42",
      "Тип: site. Отправитель: user@gmail.com.",
      "/admin/support?status=new&ticket=42",
    ]);
  });

  test("rejects too short support messages", async () => {
    const pool = { query: jest.fn() };
    const handler = supportSubmitHandler(pool);
    const req = {
      body: {
        email: "user@gmail.com",
        category: "site",
        message: "мало",
      },
    } as any;
    const res = mockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: "bad_support_message" });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("rejects external support image urls", async () => {
    const pool = { query: jest.fn() };
    const handler = supportSubmitHandler(pool);
    const req = {
      body: {
        email: "user@gmail.com",
        category: "site",
        image_url: "https://example.com/screen.png",
        message: "На странице возникает ошибка при отправке формы.",
      },
    } as any;
    const res = mockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: "bad_support_image" });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
