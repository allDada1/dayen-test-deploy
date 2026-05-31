import express from "express";
import type { Pool } from "pg";

import { ok, serverError } from "../../../utils/http";

type SearchRouterOptions = {
  pool: Pool;
};

type SearchProductRow = {
  id: number;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  section: string | null;
  tile_slug: string | null;
  image_url: string | null;
  owner_user_id: number | null;
  specs_json: string | null;
};

type SearchCategoryRow = {
  category: string | null;
};

type SearchTileRow = {
  id: number;
  title: string;
  slug: string;
  emoji: string | null;
  icon_url: string | null;
  section: string | null;
  sort_order: number | null;
};

type SearchSellerRow = {
  id: number;
  name: string;
  nickname: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  about: string | null;
};

type SearchProductHit = SearchProductRow & {
  search_score: number;
};

function normalizeForSearch(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSearchTokens(value: string) {
  return normalizeForSearch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = new Array(b.length + 1).fill(0).map((_, index) => index);
  const current = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function matchesToken(queryToken: string, candidateTokens: string[]) {
  return candidateTokens.some((candidateToken) => {
    if (!candidateToken) return false;
    if (candidateToken.includes(queryToken)) return true;
    if (queryToken.includes(candidateToken) && candidateToken.length >= 3) return true;

    const distance = levenshtein(queryToken, candidateToken);
    const tolerance = Math.max(1, Math.min(2, Math.floor(Math.max(queryToken.length, candidateToken.length) / 4)));
    return distance <= tolerance;
  });
}

function scoreProduct(row: SearchProductRow, query: string) {
  const normalizedQuery = normalizeForSearch(query);
  const queryTokens = splitSearchTokens(query);

  if (!normalizedQuery || !queryTokens.length) return 0;

  const title = normalizeForSearch(row.title);
  const category = normalizeForSearch(row.category);
  const section = normalizeForSearch(row.section || "");
  const tileSlug = normalizeForSearch(row.tile_slug || "");
  const searchBlob = [title, category, section, tileSlug].filter(Boolean).join(" ");
  const blobTokens = splitSearchTokens(searchBlob);
  const titleTokens = splitSearchTokens(title);

  const matchedAllTokens = queryTokens.every((token) => matchesToken(token, blobTokens));
  if (!matchedAllTokens) return 0;

  let score = 0;

  if (title === normalizedQuery) score += 220;
  if (title.includes(normalizedQuery)) score += 140;
  if (searchBlob.includes(normalizedQuery)) score += 50;
  if (category.includes(normalizedQuery) || section.includes(normalizedQuery)) score += 30;

  queryTokens.forEach((token) => {
    if (titleTokens.some((part) => part === token)) score += 30;
    else if (titleTokens.some((part) => part.includes(token))) score += 18;
    else if (matchesToken(token, titleTokens)) score += 12;
    else score += 6;
  });

  score += Math.max(0, 20 - Math.min(20, Math.max(0, title.length - normalizedQuery.length)));

  return score;
}

async function loadSearchProducts(pool: Pool) {
  const result = await pool.query<SearchProductRow>(
    `
    SELECT
      p.id,
      p.title,
      p.description,
      p.price,
      p.stock,
      p.category,
      p.section,
      p.tile_slug,
      COALESCE(
        (
          SELECT pi.image_url
          FROM product_images pi
          WHERE pi.product_id = p.id
          ORDER BY pi.is_cover DESC, pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ),
        p.image_url,
        ''
      ) AS image_url,
      p.owner_user_id,
      p.specs_json
    FROM products p
    LEFT JOIN users seller_user ON seller_user.id = p.owner_user_id
    WHERE p.owner_user_id IS NULL OR COALESCE(seller_user.is_seller, FALSE) = TRUE
    ORDER BY p.id DESC
    `,
  );

  return result.rows || [];
}

function searchProducts(rows: SearchProductRow[], query: string, limit?: number) {
  const hits = rows
    .map<SearchProductHit>((row) => ({
      ...row,
      search_score: scoreProduct(row, query),
    }))
    .filter((row) => row.search_score > 0)
    .sort((left, right) => {
      if (right.search_score !== left.search_score) return right.search_score - left.search_score;
      return right.id - left.id;
    });

  return typeof limit === "number" ? hits.slice(0, limit) : hits;
}

export function createSearchRouter({ pool }: SearchRouterOptions) {
  const router = express.Router();

  router.get("/search/suggest", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();

      if (!q || q.length < 2) {
        return ok(res, { tiles: [], sellers: [], products: [], categories: [] });
      }

      const products = searchProducts(await loadSearchProducts(pool), q, 8);

      const tilesRes = await pool.query<SearchTileRow>(
        `
        SELECT id, title, slug, emoji, icon_url, section, sort_order
        FROM categories
        WHERE is_active = 1
          AND (
            title ILIKE $1
            OR slug ILIKE $1
            OR section ILIKE $1
            OR emoji ILIKE $1
          )
        ORDER BY section ASC, sort_order ASC, id DESC
        LIMIT 8
        `,
        [`%${q}%`],
      );

      const sellersRes = await pool.query<SearchSellerRow>(
        `
        SELECT
          id,
          name,
          nickname,
          avatar_url,
          seller_banner_url AS banner_url,
          seller_about AS about
        FROM users
        WHERE is_seller = TRUE
          AND (
            name ILIKE $1
            OR COALESCE(nickname, '') ILIKE $1
            OR COALESCE(seller_about, '') ILIKE $1
          )
        ORDER BY id DESC
        LIMIT 4
        `,
        [`%${q}%`],
      );

      const categoriesRes = await pool.query<SearchCategoryRow>(
        `
        SELECT DISTINCT category
        FROM products p
        LEFT JOIN users seller_user ON seller_user.id = p.owner_user_id
        WHERE category IS NOT NULL
          AND category <> ''
          AND category ILIKE $1
          AND (p.owner_user_id IS NULL OR COALESCE(seller_user.is_seller, FALSE) = TRUE)
        ORDER BY category ASC
        LIMIT 8
        `,
        [`%${q}%`],
      );

      return ok(res, {
        tiles: tilesRes.rows || [],
        sellers: sellersRes.rows || [],
        products,
        categories: (categoriesRes.rows || []).map((x) => x.category).filter(Boolean),
      });
    } catch (error) {
      console.error("GET /api/search/suggest error:", error);
      return serverError(res);
    }
  });

  router.get("/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();

      if (!q) {
        return ok(res, { items: [], total: 0, q: "" });
      }

      const items = searchProducts(await loadSearchProducts(pool), q);
      return ok(res, { items, total: items.length, q });
    } catch (error) {
      console.error("GET /api/search error:", error);
      return serverError(res);
    }
  });

  return router;
}
