import { storage } from "./storage";
import { translateErrorCode } from "./errors";
import type {
  Category,
  AssistantChatResponse,
  MarketplaceSection,
  HomeHeroBanner,
  AdminAuditLog,
  AdminModerationAction,
  AdminModerationUser,
  LoginResponse,
  RegisterResponse,
  Order,
  OrderCreateInput,
  Product,
  ProfileResponse,
  NotificationItem,
  Review,
  SellerProfile,
  SellerRequest,
  SellerSale,
  SellerClaim,
  SupportTicket,
  SellerStats,
  SearchSeller,
  Tile,
} from "../types/api";

const REQUEST_TIMEOUT_MS = 25000;
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/$/, "");

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function apiUrl(path: string) {
  if (!API_BASE_URL || isAbsoluteUrl(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function publicUrl(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!API_BASE_URL || isAbsoluteUrl(value) || !value.startsWith("/uploads/")) return value;
  return `${API_BASE_URL}${value}`;
}

function normalizeApiPayload<T>(payload: T, requestUrl: string): T {
  if (!API_BASE_URL) return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeApiPayload(item, requestUrl)) as T;
  }

  if (payload && typeof payload === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      next[key] = typeof value === "string" ? publicUrl(value) : normalizeApiPayload(value, requestUrl);
    }
    return next as T;
  }

  return payload;
}

async function request<T>(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  const token = storage.getToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(url), {
      ...init,
      headers,
      credentials: "include",
      signal: init?.signal || controller.signal,
    });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      throw new Error("request_timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload?.error || payload?.message;
    const error = new Error(translateErrorCode(code, response.status) || code || `HTTP ${response.status}`);
    (error as Error & { payload?: unknown; status?: number }).payload = payload;
    (error as Error & { payload?: unknown; status?: number }).status = response.status;
    throw error;
  }

  return normalizeApiPayload(payload as T, url);
}

export const api = {
  getCategories() {
    return request<{ items: Category[] }>("/api/categories");
  },
  getMarketplaceSections() {
    return request<{ items: MarketplaceSection[] }>("/api/sections");
  },
  getHomeBanner() {
    return request<{ banner: HomeHeroBanner | null }>("/api/home-banner");
  },
  getPageBanner(pageKey: string) {
    return request<{ banner: HomeHeroBanner | null }>(`/api/page-banners/${encodeURIComponent(pageKey)}`);
  },
  getTiles() {
    return request<{ tiles: Tile[] }>("/api/tiles");
  },
  getProducts(params?: {
    q?: string;
    cat?: string;
    section?: string;
    tile_slug?: string;
    sort?: "price" | "likes" | "rating" | "new";
    dir?: "asc" | "desc";
  }) {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.cat) search.set("cat", params.cat);
    if (params?.section) search.set("section", params.section);
    if (params?.tile_slug) search.set("tile_slug", params.tile_slug);
    if (params?.sort) search.set("sort", params.sort);
    if (params?.dir) search.set("dir", params.dir);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ items: Product[] }>(`/api/products${suffix}`);
  },
  getSearchSuggestions(q: string) {
    const search = new URLSearchParams();
    search.set("q", q);
    return request<{ tiles: Tile[]; sellers: SearchSeller[]; products: Product[]; categories: string[] }>(
      `/api/search/suggest?${search.toString()}`,
    );
  },
  getSearchResults(q: string) {
    const search = new URLSearchParams();
    search.set("q", q);
    return request<{ items: Product[]; total: number; q: string }>(`/api/search?${search.toString()}`);
  },
  chatAssistant(input: { message: string; history?: Array<{ role: "user" | "assistant"; text: string }> }) {
    return request<AssistantChatResponse>("/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getTileProducts(slug: string) {
    return request<{ items: Product[] }>(`/api/tiles/${slug}/products`);
  },
  getProduct(id: string | number) {
    return request<{ product: Product }>(`/api/products/${id}`);
  },
  getProductReviews(productId: number) {
    return request<{ items: Review[] }>(`/api/reviews/${productId}`);
  },
  canReviewProduct(productId: number) {
    return request<{ can_review: boolean; reason: string | null; already_reviewed: boolean; order_id?: number }>(
      `/api/reviews/${productId}/can-review`,
    );
  },
  createReview(input: { product_id: number; rating: number; comment?: string }) {
    return request<{ review: Review }>("/api/reviews", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  login(email: string, password: string, totp_code?: string) {
    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, totp_code }),
    });
  },
  getGoogleConfig() {
    return request<{ clientId: string | null }>("/api/auth/google-config");
  },
  loginWithGoogle(accessToken: string, totp_code?: string) {
    return request<LoginResponse>("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken, totp_code }),
    });
  },
  register(name: string, email: string, password: string) {
    return request<RegisterResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },
  verifyEmail(token: string) {
    return request<{ message: string }>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  resendVerificationEmail() {
    return request<{ message: string }>("/api/auth/verify-email/resend", {
      method: "POST",
    });
  },
  resendVerificationEmailPublic(email: string) {
    return request<{ message: string }>("/api/auth/verify-email/resend-public", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  forgotPassword(email: string) {
    return request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token: string, password: string) {
    return request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
  changePassword(input: { current_password: string; new_password: string; totp_code?: string }) {
    return request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getTwoFactorStatus() {
    return request<{ enabled: boolean; required: boolean }>("/api/auth/2fa/status");
  },
  setupTwoFactor() {
    return request<{ secret: string; otpauth_url: string }>("/api/auth/2fa/setup", {
      method: "POST",
    });
  },
  enableTwoFactor(code: string) {
    return request<ProfileResponse>("/api/auth/2fa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },
  disableTwoFactor(input: { password: string; code: string }) {
    return request<ProfileResponse>("/api/auth/2fa/disable", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getMe() {
    return request<ProfileResponse>("/api/auth/me");
  },
  logout() {
    return request("/api/auth/logout", { method: "POST" });
  },
  updateProfile(input: { name?: string; nickname?: string; theme?: string; lang?: string }) {
    return request<ProfileResponse>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  uploadProfileAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    return request<{ avatar_url: string; user: ProfileResponse["user"] }>("/api/profile/avatar", {
      method: "POST",
      body: formData,
    });
  },
  deleteProfileAvatar() {
    return request<{ avatar_url: string; user: ProfileResponse["user"] }>("/api/profile/avatar", {
      method: "DELETE",
    });
  },
  likeProduct(id: number) {
    return request<{ liked: boolean; likes: number }>(`/api/products/${id}/like`, { method: "POST" });
  },
  getFavorites() {
    return request<{ items: Product[] }>("/api/favorites");
  },
  getMyOrders() {
    return request<Order[]>("/api/orders/my");
  },
  createOrder(input: OrderCreateInput) {
    return request<{ id: number }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getSellerRequestStatus() {
    return request<{ request: SellerRequest | null }>("/api/seller/request-status");
  },
  applySeller(input: {
    shop_name: string;
    shop_slug: string;
    avatar_url?: string;
    contacts?: string;
    about?: string;
  }) {
    return request<{ message: string }>("/api/seller/apply", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getSellerMe() {
    return request<{ seller: SellerProfile }>("/api/seller/me");
  },
  updateSellerProfile(input: {
    shop_name: string;
    avatar_url?: string;
    banner_url?: string;
    about?: string;
    telegram?: string;
    instagram?: string;
    whatsapp?: string;
    tiktok?: string;
  }) {
    return request("/api/seller/profile", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getSellerProducts(params?: {
    page?: number;
    limit?: number;
    q?: string;
    tile?: string;
    sort?: string;
  }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.q) search.set("q", params.q);
    if (params?.tile) search.set("tile", params.tile);
    if (params?.sort) search.set("sort", params.sort);
    const suffix = search.toString() ? `?${search.toString()}` : "";

    return request<{
      products: Product[];
      total?: number;
      limit?: number;
      offset?: number;
      page?: number;
      total_pages?: number;
      has_prev?: boolean;
      has_next?: boolean;
      tiles?: Array<{ tile_slug: string; category: string }>;
    }>(`/api/seller/products${suffix}`);
  },
  createSellerProduct(input: Record<string, unknown>) {
    return request<{ id: number }>("/api/seller/products", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateSellerProduct(id: number, input: Record<string, unknown>) {
    return request(`/api/seller/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  deleteSellerProduct(id: number) {
    return request(`/api/seller/products/${id}`, {
      method: "DELETE",
    });
  },
  getSellerSales() {
    return request<{ items: SellerSale[]; summary: { total_count: number; new_count: number } }>("/api/seller/sales");
  },
  getSellerClaims() {
    return request<{ items: SellerClaim[] }>("/api/seller/claims");
  },
  getAdminClaims() {
    return request<{ items: SellerClaim[] }>("/api/admin/claims");
  },
  updateSellerClaim(id: number, input: { status: string; seller_reply?: string }) {
    return request(`/api/seller/claims/${id}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateAdminClaim(id: number, input: { status: string; resolution?: string }) {
    return request(`/api/admin/claims/${id}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateSellerSaleStatus(id: number, input: { status: string; note?: string }) {
    return request(`/api/seller/sales/${id}/status`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getAdminSellerRequests() {
    return request<{ items: SellerRequest[]; requests: SellerRequest[] }>("/api/admin/seller-requests");
  },
  getAdminUsers(params?: { page?: number; limit?: number; q?: string; status?: string; role?: string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.q) search.set("q", params.q);
    if (params?.status) search.set("status", params.status);
    if (params?.role) search.set("role", params.role);
    const suffix = search.toString() ? `?${search.toString()}` : "";

    return request<{
      users: AdminModerationUser[];
      total: number;
      page: number;
      limit: number;
      total_pages: number;
    }>(`/api/admin/users${suffix}`);
  },
  getAdminUser(id: number) {
    return request<{ user: AdminModerationUser; audit: AdminModerationAction[] }>(`/api/admin/users/${id}`);
  },
  warnAdminUser(id: number, reason: string) {
    return request<{ user: AdminModerationUser }>(`/api/admin/users/${id}/warn`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  banAdminUser(id: number, input: { reason: string; banned_until?: string }) {
    return request<{ user: AdminModerationUser }>(`/api/admin/users/${id}/ban`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  unbanAdminUser(id: number, reason: string) {
    return request<{ user: AdminModerationUser }>(`/api/admin/users/${id}/unban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  updateAdminUserProfile(id: number, input: { name?: string; nickname?: string; avatar_url?: string; reason: string }) {
    return request<{ user: AdminModerationUser }>(`/api/admin/users/${id}/profile`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  grantAdminUser(id: number, reason: string) {
    return request<{ user: AdminModerationUser }>(`/api/admin/users/${id}/grant-admin`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  revokeAdminUser(id: number, reason: string) {
    return request<{ user: AdminModerationUser }>(`/api/admin/users/${id}/revoke-admin`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  getAdminAuditLogs(target_user_id?: number) {
    const suffix = target_user_id ? `?target_user_id=${target_user_id}` : "";
    return request<{ items: AdminModerationAction[] }>(`/api/admin/audit-logs${suffix}`);
  },
  getAdminActionLogs(limit = 120) {
    return request<{ items: AdminAuditLog[] }>(`/api/admin/action-logs?limit=${limit}`);
  },
  approveAdminSellerRequest(id: number) {
    return request(`/api/admin/seller-requests/${id}/approve`, { method: "POST" });
  },
  rejectAdminSellerRequest(id: number, admin_comment: string) {
    return request(`/api/admin/seller-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ admin_comment }),
    });
  },
  revokeAdminSellerRequest(id: number, admin_comment: string) {
    return request(`/api/admin/seller-requests/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ admin_comment }),
    });
  },
  restoreAdminSellerRequest(id: number, admin_comment: string) {
    return request(`/api/admin/seller-requests/${id}/restore`, {
      method: "POST",
      body: JSON.stringify({ admin_comment }),
    });
  },
  getSeller(id: number) {
    return request<{ seller: SellerProfile; stats: SellerStats }>(`/api/sellers/${id}`);
  },
  getSellerPublicProducts(id: number) {
    return request<{ items: Product[] }>(`/api/sellers/${id}/products`);
  },
  getSellerPublicReviews(id: number) {
    return request<{ items: Review[] }>(`/api/sellers/${id}/reviews`);
  },
  getSellerFollowing(id: number) {
    return request<{ following: boolean }>(`/api/sellers/${id}/following`);
  },
  followSeller(id: number) {
    return request(`/api/sellers/${id}/follow`, { method: "POST" });
  },
  unfollowSeller(id: number) {
    return request(`/api/sellers/${id}/follow`, { method: "DELETE" });
  },
  getOrder(id: number) {
    return request<{ order: Order; items: Array<Record<string, unknown>> }>(`/api/orders/${id}`);
  },
  getOrderHistory(id: number) {
    return request<{ items: Array<{ status: string; note?: string; created_at?: string }> }>(`/api/orders/${id}/history`);
  },
  getOrderClaims(id: number) {
    return request<{ items: SellerClaim[] }>(`/api/orders/${id}/claims`);
  },
  repeatOrder(id: number) {
    return request<{ items: Array<{ product_id: number; qty: number; available_stock: number }> }>(`/api/orders/${id}/repeat`, {
      method: "POST",
    });
  },
  createOrderClaim(id: number, input: { type: "return" | "dispute"; reason: string }) {
    return request<{ claim_type: "return" | "dispute" }>(`/api/orders/${id}/claim`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  createSupportTicket(input: { email: string; category: string; page_url?: string; image_url?: string; image_urls?: string[]; message: string }) {
    return request<{ ticket: Pick<SupportTicket, "id" | "status" | "created_at">; message: string }>("/api/support/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getAdminSupportTickets(params?: { page?: number; limit?: number; status?: string; category?: string; priority?: string; q?: string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.status) search.set("status", params.status);
    if (params?.category) search.set("category", params.category);
    if (params?.priority) search.set("priority", params.priority);
    if (params?.q) search.set("q", params.q);
    const suffix = search.toString() ? `?${search.toString()}` : "";

    return request<{ items: SupportTicket[]; total: number; page: number; limit: number; total_pages: number }>(
      `/api/admin/support-tickets${suffix}`,
    );
  },
  updateAdminSupportTicket(id: number, input: { status?: string; priority?: string; admin_note?: string }) {
    return request<{ ticket: SupportTicket }>(`/api/admin/support-tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  updateOrderStatus(id: number, input: { status: string; note?: string }) {
    return request(`/api/orders/${id}/status`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  createAdminProduct(input: Record<string, unknown>) {
    return request<{ id: number }>("/api/products", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  uploadImage(file: File, bucket = "products") {
    const formData = new FormData();
    formData.append("image", file);
    const search = new URLSearchParams();
    search.set("bucket", bucket);
    return request<{ url: string }>(`/api/uploads/image?${search.toString()}`, {
      method: "POST",
      body: formData,
    });
  },
  updateAdminProduct(id: number, input: Record<string, unknown>) {
    return request(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteAdminProduct(id: number) {
    return request(`/api/products/${id}`, {
      method: "DELETE",
    });
  },
  getAdminCategories() {
    return request<{ items: Tile[] }>("/api/admin/categories");
  },
  getAdminSections() {
    return request<{ items: MarketplaceSection[] }>("/api/admin/sections");
  },
  createAdminSection(input: Record<string, unknown>) {
    return request<{ id: number }>("/api/admin/sections", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateAdminSection(id: number, input: Record<string, unknown>) {
    return request(`/api/admin/sections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteAdminSection(id: number) {
    return request(`/api/admin/sections/${id}`, {
      method: "DELETE",
    });
  },
  getAdminHomeBanner() {
    return request<{ banner: HomeHeroBanner | null }>("/api/admin/home-banner");
  },
  updateAdminHomeBanner(input: Record<string, unknown>) {
    return request(`/api/admin/home-banner`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  getAdminPageBanner(pageKey: string) {
    return request<{ banner: HomeHeroBanner | null }>(`/api/admin/page-banners/${encodeURIComponent(pageKey)}`);
  },
  updateAdminPageBanner(pageKey: string, input: Record<string, unknown>) {
    return request(`/api/admin/page-banners/${encodeURIComponent(pageKey)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  createAdminCategory(input: Record<string, unknown>) {
    return request<{ id: number }>("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  updateAdminCategory(id: number, input: Record<string, unknown>) {
    return request(`/api/admin/categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  deleteAdminCategory(id: number) {
    return request(`/api/admin/categories/${id}`, {
      method: "DELETE",
    });
  },
  payOrder(id: number, method: string) {
    return request(`/api/orders/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ method }),
    });
  },
  getNotifications() {
    return request<{ unread_count: number; items: NotificationItem[] }>("/api/notifications");
  },
  markNotificationsRead(ids: number[]) {
    return request<{ updated: number }>("/api/notifications/read", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
  },
  clearNotifications() {
    return request<{ deleted: number }>("/api/notifications/clear", {
      method: "POST",
    });
  },
};
