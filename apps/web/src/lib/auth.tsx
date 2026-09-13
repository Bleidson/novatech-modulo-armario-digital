import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api } from "./api";
import { useTenantPath } from "./tenantPath";

export type Role = "ADMIN" | "PROFESSOR";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
}

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  // Reconsulta /auth/me - usado pela pagina Conta depois de PATCH /auth/me para
  // refletir nome/telefone novos no Header e no resto do app sem precisar de F5.
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    api
      .get<AuthUser>("/auth/me")
      .then((u) => {
        if (!cancelled) {
          setUser(u);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setStatus("anonymous");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.post<AuthUser>("/auth/login", { email, password });
    setUser(u);
    setStatus("authenticated");
    return u;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
    setStatus("anonymous");
  }, []);

  const refresh = useCallback(async () => {
    const u = await api.get<AuthUser>("/auth/me");
    setUser(u);
  }, []);

  return <AuthContext.Provider value={{ user, status, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();
  const tenantPath = useTenantPath();

  if (status === "loading") {
    return <div className="p-8 text-center text-sm text-muted">Carregando...</div>;
  }
  if (status === "anonymous" || !user) {
    return <Navigate to={tenantPath("/login")} state={{ from: location }} replace />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={tenantPath("/login")} replace />;
  }
  return <>{children}</>;
}
