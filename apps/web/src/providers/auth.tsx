import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import { api } from "../services/api";
import { storage } from "../services/storage";
import type { ApiUser } from "../types/api";

type AuthContextValue = {
  user: ApiUser | null;
  token: string;
  loading: boolean;
  login: (token: string | undefined, user: ApiUser) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<ApiUser | null>(() => storage.getUser<ApiUser>());
  const [token, setToken] = useState(() => storage.getToken());
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const activeToken = storage.getToken();
    setToken(activeToken);

    try {
      const response = await api.getMe();
      storage.clearToken();
      storage.setUser(response.user ?? null);
      startTransition(() => {
        setToken("");
        setUser(response.user ?? null);
      });
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (status === 401 || status === 403) {
        storage.clearToken();
        startTransition(() => {
          setUser(null);
          setToken("");
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function login(_nextToken: string | undefined, nextUser: ApiUser) {
    storage.clearToken();
    storage.setUser(nextUser);
    startTransition(() => {
      setToken("");
      setUser(nextUser);
    });
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      // best effort
    } finally {
      storage.clearToken();
      startTransition(() => {
        setToken("");
        setUser(null);
      });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
