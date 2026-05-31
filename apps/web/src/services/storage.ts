const TOKEN_KEY = "market_token";
const CART_KEY = "market_cart_v2";
const USER_KEY = "market_user";

export const storage = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  getUser<T>() {
    try {
      const value = JSON.parse(localStorage.getItem(USER_KEY) || "null");
      return value as T | null;
    } catch {
      return null;
    }
  },
  setUser(user: unknown) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearUser() {
    localStorage.removeItem(USER_KEY);
  },
  getCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(raw) ? raw.map((value) => Number(value)).filter(Number.isFinite) : [];
    } catch {
      return [];
    }
  },
  setCart(ids: number[]) {
    localStorage.setItem(CART_KEY, JSON.stringify(ids));
  },
};
