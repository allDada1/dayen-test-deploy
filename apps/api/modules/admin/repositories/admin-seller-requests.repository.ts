import type { Pool, PoolClient } from "pg";

export type SellerRequestRow = {
  id: number;
  user_id: number;
  shop_name: string;
  shop_slug: string;
  avatar_url: string | null;
  about: string | null;
  contacts: string | null;
  status: string;
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
  user_name?: string;
  email?: string;
  is_seller?: boolean;
  seller_access?: boolean;
};

type Queryable = Pool | PoolClient;

const REQUESTS_LIST_SQL = `
  SELECT sr.id,
         sr.user_id,
         sr.shop_name,
         sr.shop_slug,
         sr.avatar_url,
         sr.about,
         sr.contacts,
         sr.status,
         sr.admin_comment,
         sr.created_at,
         sr.reviewed_at,
         COALESCE(u.name, '') AS user_name,
         COALESCE(u.email, '') AS email,
         COALESCE(u.is_seller, FALSE) AS is_seller,
         COALESCE(u.seller_access, FALSE) AS seller_access
  FROM seller_requests sr
  LEFT JOIN users u ON u.id = sr.user_id
  ORDER BY sr.created_at DESC
`;

export function createAdminSellerRequestsRepository(pool: Pool) {
  return {
    async withTransaction<T>(handler: (client: PoolClient) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await handler(client);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {}
        throw error;
      } finally {
        client.release();
      }
    },

    async listRequests() {
      const result = await pool.query<SellerRequestRow>(REQUESTS_LIST_SQL);
      return result.rows || [];
    },

    async approveRequest(client: Queryable, id: number) {
      const result = await client.query<SellerRequestRow>(
        `UPDATE seller_requests
         SET status = 'approved',
             reviewed_at = NOW()
         WHERE id = $1
           AND status = 'pending'
         RETURNING user_id, shop_slug, shop_name, avatar_url, about`,
        [id],
      );

      return result.rows[0] || null;
    },

    async applyApprovedSeller(client: Queryable, request: SellerRequestRow) {
      await client.query(
        `UPDATE users
         SET is_seller = TRUE,
             seller_access = TRUE,
             nickname = $1,
             name = $2,
             avatar_url = COALESCE(NULLIF($3, ''), avatar_url),
             seller_about = COALESCE($4, '')
         WHERE id = $5`,
        [request.shop_slug, request.shop_name, request.avatar_url, request.about, request.user_id],
      );
    },

    async rejectRequest(id: number, adminComment: string) {
      const result = await pool.query(
        `UPDATE seller_requests
         SET status = 'rejected',
             reviewed_at = NOW(),
             admin_comment = $2
         WHERE id = $1
           AND status = 'pending'`,
        [id, adminComment],
      );

      return (result.rowCount || 0) > 0;
    },

    async findRequest(client: Queryable, id: number) {
      const result = await client.query<SellerRequestRow>(
        `SELECT id, user_id, status
         FROM seller_requests
         WHERE id = $1
         LIMIT 1`,
        [id],
      );

      return result.rows[0] || null;
    },

    async revokeSeller(client: Queryable, userId: number) {
      await client.query(
        `UPDATE users
         SET is_seller = FALSE
             , seller_access = FALSE
         WHERE id = $1`,
        [userId],
      );
    },

    async markRequestReviewed(client: Queryable, id: number, adminComment: string) {
      await client.query(
        `UPDATE seller_requests
         SET reviewed_at = NOW(),
             admin_comment = $2
         WHERE id = $1`,
        [id, adminComment],
      );
    },

    async restoreSeller(client: Queryable, userId: number) {
      await client.query(
        `UPDATE users
         SET is_seller = TRUE,
             seller_access = TRUE
         WHERE id = $1`,
        [userId],
      );
    },

    async markRequestApprovedAgain(client: Queryable, id: number, adminComment: string) {
      await client.query(
        `UPDATE seller_requests
         SET status = 'approved',
             reviewed_at = NOW(),
             admin_comment = $2
         WHERE id = $1`,
        [id, adminComment],
      );
    },
  };
}
