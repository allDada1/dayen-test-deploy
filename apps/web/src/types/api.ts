export type ApiUser = {
  id: number;
  name: string;
  email: string;
  email_verified?: boolean;
  is_owner?: boolean;
  is_admin: boolean;
  two_factor_enabled?: boolean;
  is_seller?: boolean;
  seller_access?: boolean;
  nickname?: string;
  avatar_url?: string;
  theme?: string;
  lang?: string;
  status?: string;
  banned_until?: string | null;
  warning_count?: number;
};

export type Product = {
  id: number;
  title: string;
  description: string;
  category: string;
  section?: string;
  tile_slug?: string;
  image_url?: string;
  images?: string[];
  price: number;
  stock: number;
  owner_user_id?: number;
  likes?: number;
  rating_avg?: number;
  rating_count?: number;
  is_liked?: boolean;
  my_rating?: number | null;
  specs?: Array<{ key: string; value: string }>;
  specs_json?: string;
};

export type AssistantProductSuggestion = {
  id: number;
  title: string;
  description?: string;
  price: number;
  stock: number;
  category?: string;
  section?: string;
  tile_slug?: string;
  image_url?: string;
  url: string;
};

export type AssistantAction = {
  kind:
    | "product"
    | "catalog"
    | "cart"
    | "orders"
    | "profile"
    | "seller"
    | "support"
    | "report"
    | "verify_email";
  label: string;
  href: string;
  title?: string;
  subtitle?: string;
  image_url?: string;
  price?: number;
};

export type AssistantChatResponse = {
  reply: string;
  actions?: AssistantAction[];
  product_suggestions: AssistantProductSuggestion[];
  mode: "ai" | "fallback";
};

export type Category = {
  id: number;
  group_name: string;
  section: string;
  title: string;
  slug: string;
  icon_url?: string;
  emoji?: string;
  sort_order?: number;
};

export type MarketplaceSection = {
  id: number;
  title: string;
  slug: string;
  icon_url?: string;
  emoji?: string;
  sort_order?: number;
  is_active?: boolean | number;
};

export type HomeHeroBanner = {
  id: number;
  page_key?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  cta_label?: string;
  cta_href?: string;
  image_url?: string;
  is_active?: boolean | number;
  sort_order?: number;
};

export type LoginResponse = {
  token?: string;
  user: ApiUser;
};

export type RegisterResponse = {
  message: string;
  email: string;
};

export type ProfileResponse = {
  user: ApiUser;
};

export type Order = {
  id: number;
  status?: string;
  display_status?: string;
  subtotal?: number;
  delivery_price?: number;
  total?: number;
  delivery_method?: string;
  delivery_city?: string;
  delivery_address?: string;
  phone?: string;
  contact_email?: string;
  comment?: string;
  created_at?: string;
};

export type OrderItemInput = {
  product_id: number;
  qty: number;
};

export type OrderCreateInput = {
  items: OrderItemInput[];
  delivery: {
    method: string;
    city: string;
    address: string;
    phone: string;
    email?: string;
    price: number;
  };
  comment?: string;
};

export type SellerRequest = {
  id: number;
  user_id: number;
  shop_name: string;
  shop_slug: string;
  avatar_url?: string | null;
  about?: string | null;
  contacts?: string | null;
  status: string;
  admin_comment?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
  user_name?: string;
  email?: string;
  is_seller?: boolean;
  seller_access?: boolean;
};

export type AdminModerationUser = ApiUser & {
  status: string;
  banned_until: string | null;
  restrictions?: Record<string, unknown>;
  warning_count: number;
  moderation_note?: string;
  products_count?: number;
  orders_count?: number;
};

export type AdminModerationAction = {
  id: number;
  actor_user_id: number | null;
  actor_name?: string | null;
  target_user_id: number;
  target_name?: string | null;
  action: string;
  reason: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};

export type AdminAuditLog = {
  id: number;
  actor_user_id: number | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  target_user_id?: number | null;
  target_name?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
};

export type SellerProfile = {
  id: number;
  is_seller: boolean;
  username: string;
  name: string;
  avatar_url: string;
  banner_url: string;
  seller_about?: string;
  seller_telegram?: string;
  seller_instagram?: string;
  seller_whatsapp?: string;
  seller_tiktok?: string;
  about?: string;
  telegram?: string;
  instagram?: string;
  whatsapp?: string;
  tiktok?: string;
};

export type SellerSale = {
  sale_id: number;
  order_id: number;
  status: string;
  seller_note?: string;
  order_comment?: string;
  created_at?: string;
  buyer_name?: string;
  buyer_email?: string;
  product_id: number;
  product_title: string;
  image_url?: string;
  price: number;
  qty: number;
  line_total: number;
};

export type SellerClaim = {
  id: number;
  order_id: number;
  user_id: number;
  seller_user_id: number;
  type: "return" | "dispute";
  status: "open" | "in_review" | "approved" | "rejected" | "resolved" | "escalated";
  reason: string;
  seller_reply?: string;
  resolution?: string;
  created_at?: string;
  updated_at?: string;
  buyer_name?: string;
  buyer_email?: string;
  items_count?: number;
  image_url?: string;
  product_titles?: string;
  seller_name?: string;
  seller_email?: string;
  order_status?: string;
  order_total?: number;
};

export type SupportTicket = {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  email: string;
  category: "site" | "order" | "payment" | "seller" | "account" | "other";
  page_url: string;
  image_url?: string;
  image_urls?: string[];
  image_urls_json?: string;
  message: string;
  status: "new" | "in_review" | "resolved" | "closed";
  priority: "normal" | "high";
  admin_note?: string;
  created_at?: string;
  updated_at?: string;
  resolved_at?: string | null;
};

export type Review = {
  id: number;
  user_id?: number;
  product_id?: number;
  rating: number;
  comment?: string | null;
  created_at?: string;
  name?: string | null;
  user_name?: string;
  product_title?: string;
  product_id_ref?: number;
  product_image_url?: string;
};

export type SellerStats = {
  products_count: number;
  likes_count: number;
  review_count: number;
};

export type Tile = {
  id: number;
  title: string;
  slug: string;
  emoji?: string;
  icon_url?: string;
  section?: string;
  sort_order?: number;
  is_active?: number;
};

export type SearchSeller = {
  id: number;
  name: string;
  nickname?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  about?: string | null;
};

export type NotificationItem = {
  id: number;
  title: string;
  body: string;
  link?: string | null;
  is_read: boolean;
  created_at?: string;
};
