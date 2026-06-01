import { pool } from "./pool";

export async function createBaseTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      is_owner BOOLEAN NOT NULL DEFAULT FALSE,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      two_factor_secret TEXT NOT NULL DEFAULT '',
      two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      group_name TEXT NOT NULL,
      section TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon_url TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '🎮',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      tile_slug TEXT NOT NULL DEFAULT '',
      section TEXT NOT NULL DEFAULT 'Игры'
    );

    CREATE TABLE IF NOT EXISTS product_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS product_ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      delivery_price INTEGER NOT NULL,
      total INTEGER NOT NULL,
      delivery_method TEXT NOT NULL,
      delivery_city TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      phone TEXT NOT NULL,
      contact_email TEXT NOT NULL DEFAULT '',
      comment TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL,
      qty INTEGER NOT NULL,
      seller_status TEXT DEFAULT 'pending',
      seller_note TEXT DEFAULT '',
      seller_updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_claims (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      reason TEXT NOT NULL DEFAULT '',
      seller_reply TEXT NOT NULL DEFAULT '',
      resolution TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_cover BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS seller_follows (
      follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (NOW()::text),
      PRIMARY KEY (follower_user_id, seller_user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT (NOW()::text)
    );

    CREATE TABLE IF NOT EXISTS seller_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL,
      shop_slug TEXT NOT NULL,
      avatar_url TEXT NOT NULL DEFAULT '',
      about TEXT NOT NULL DEFAULT '',
      contacts TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      admin_comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_moderation_actions (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL DEFAULT '',
      target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      summary TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS marketplace_sections (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon_url TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS home_hero_banners (
      id SERIAL PRIMARY KEY,
      eyebrow TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cta_label TEXT NOT NULL DEFAULT '',
      cta_href TEXT NOT NULL DEFAULT '/catalog',
      image_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS page_banners (
      id SERIAL PRIMARY KEY,
      page_key TEXT NOT NULL UNIQUE,
      eyebrow TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cta_label TEXT NOT NULL DEFAULT '',
      cta_href TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'site',
      page_url TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      image_urls_json TEXT NOT NULL DEFAULT '[]',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      priority TEXT NOT NULL DEFAULT 'normal',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
  `);
}

export async function applySchemaUpdates() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seller BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_access BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_about TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_banner_url TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_telegram TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_instagram TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_whatsapp TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_tiktok TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS specs_json TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'ru';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS restrictions_json TEXT NOT NULL DEFAULT '{}';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_note TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;`);

  await pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_status TEXT DEFAULT 'pending';`);
  await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_note TEXT DEFAULT '';`);
  await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS seller_updated_at TIMESTAMP DEFAULT NOW();`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS specs_json TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';`);
  await pool.query(`ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS image_urls_json TEXT NOT NULL DEFAULT '[]';`);
  await pool.query(`UPDATE users SET is_admin = TRUE WHERE is_owner = TRUE AND is_admin = FALSE;`);
  const ownerEmail = String(process.env.OWNER_EMAIL || "").trim().toLowerCase();
  if (ownerEmail) {
    await pool.query(
      `UPDATE users
          SET is_owner = TRUE,
              is_admin = TRUE,
              email_verified = TRUE
        WHERE LOWER(email) = $1`,
      [ownerEmail],
    );
  }
  await pool.query(`UPDATE users SET seller_access = TRUE WHERE is_seller = TRUE AND seller_access = FALSE;`);
  await pool.query(`
    UPDATE products p
       SET owner_user_id = NULL
      FROM users u
     WHERE p.owner_user_id = u.id
       AND COALESCE(u.is_seller, FALSE) = FALSE
  `);
  await pool.query(`
    INSERT INTO marketplace_sections (title, slug, emoji, sort_order, is_active)
    SELECT v.title, v.slug, v.emoji, v.sort_order, v.is_active
    FROM (
      VALUES
        ('Игры', 'games', '🎮', 0, 1),
        ('Мобильные игры', 'mobile', '📱', 1, 1),
        ('Приложения', 'apps', '🧩', 2, 1)
    ) AS v(title, slug, emoji, sort_order, is_active)
    WHERE NOT EXISTS (
      SELECT 1
      FROM marketplace_sections ms
      WHERE ms.slug = v.slug OR ms.title = v.title
    )
  `);
  await pool.query(`
    INSERT INTO home_hero_banners (eyebrow, title, description, cta_label, cta_href, is_active, sort_order)
    SELECT '', '', '', '', '/catalog', 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM home_hero_banners)
  `);
}

export async function createIndexes() {
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_reviews_user_product ON reviews(user_id, product_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_owner_user_id ON products(owner_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_follows_seller ON seller_follows(seller_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_follows_follower ON seller_follows(follower_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_items_seller_status ON order_items(seller_status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_claims_order_id ON order_claims(order_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_claims_seller_status ON order_claims(seller_user_id, status);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_seller_requests_shop_slug_lower ON seller_requests (LOWER(shop_slug));`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_requests_user_id ON seller_requests(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_requests_status ON seller_requests(status);`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_seller_requests_one_pending_per_user ON seller_requests(user_id) WHERE status = 'pending';`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_is_owner ON users(is_owner);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_banned_until ON users(banned_until);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_moderation_target_created ON user_moderation_actions(target_user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_moderation_actor_created ON user_moderation_actions(actor_user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC, id DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_created ON admin_audit_logs(actor_user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON admin_audit_logs(entity_type, entity_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_marketplace_sections_sort ON marketplace_sections(sort_order, id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_home_hero_banners_active_sort ON home_hero_banners(is_active, sort_order, id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_banners_page_active ON page_banners(page_key, is_active, sort_order, id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created ON support_tickets(status, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created ON support_tickets(user_id, created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_support_tickets_category_created ON support_tickets(category, created_at DESC);`);
}

export async function migrate() {
  await createBaseTables();
  await applySchemaUpdates();
  await createIndexes();
}
