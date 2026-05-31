import {
  normalizeSpaces,
  parseEmail,
  parseEnum,
  parseIdArray,
  parseRequiredString,
  parseSlug,
} from "../utils/validation";

describe("validation utils", () => {
  test("normalizeSpaces collapses repeated whitespace", () => {
    expect(normalizeSpaces("  hello   world  ")).toBe("hello world");
  });

  test("parseRequiredString trims and validates length", () => {
    expect(parseRequiredString("  Store  ", { min: 2, max: 10 })).toBe("Store");
    expect(parseRequiredString("x", { min: 2, max: 10 })).toBeNull();
  });

  test("parseEmail accepts valid email and rejects malformed input", () => {
    expect(parseEmail("User@Example.com")).toBe("user@example.com");
    expect(parseEmail("not-an-email")).toBeNull();
  });

  test("parseSlug normalizes to lowercase and rejects invalid symbols", () => {
    expect(parseSlug("My_Shop-1")).toBe("my_shop-1");
    expect(parseSlug("bad slug")).toBeNull();
  });

  test("parseEnum returns fallback for unknown value", () => {
    expect(parseEnum("LIGHT", ["dark", "light"], null)).toBe("light");
    expect(parseEnum("blue", ["dark", "light"], "dark")).toBe("dark");
  });

  test("parseIdArray keeps unique positive integers only", () => {
    expect(parseIdArray([1, "2", 2, 0, -1, "bad", 5])).toEqual([1, 2, 5]);
  });
});
