import { normalizeImagesInput, saveProductImages } from "../utils/product-images";

describe("product images utils", () => {
  test("normalizeImagesInput removes duplicates and empty values", () => {
    expect(
      normalizeImagesInput([
        " /a.png ",
        { image_url: "/b.png" },
        "",
        { image_url: "/a.png" },
      ]),
    ).toEqual(["/a.png", "/b.png"]);
  });

  test("saveProductImages falls back to cover image and persists ordered records", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const pool = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: 1 };
      }),
    };

    const images = await saveProductImages(pool as any, 42, [], "/cover.png");

    expect(images).toEqual(["/cover.png"]);
    expect(queries).toHaveLength(3);
    expect(queries[0].params).toEqual([42]);
    expect(queries[1].params).toEqual([42, "/cover.png", 0, true]);
    expect(queries[2].params).toEqual([42, "/cover.png"]);
  });
});
