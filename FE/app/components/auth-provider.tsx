"use client";

import { createContext, useContext } from "react";
import { useAuthUser, type AuthUser } from "@/lib/queries";

interface AuthContext {
  user: AuthUser | null;
  loading: boolean;
}

const Ctx = createContext<AuthContext>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useAuthUser();
  return <Ctx.Provider value={{ user: data ?? null, loading: isPending }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
