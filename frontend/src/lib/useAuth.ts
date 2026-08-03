"use client";
import { useCallback, useEffect, useState } from "react";
import { authApi, type AuthUser } from "@/lib/api";

type State =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous"; user: null };

/**
 * Status sesi untuk komponen klien. Token ada di cookie httpOnly sehingga
 * tidak bisa dibaca JavaScript — satu-satunya cara mengetahui status login
 * adalah menanyakannya ke /auth/me.
 */
export function useAuth() {
  const [state, setState] = useState<State>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState({ status: "authenticated", user });
    } catch {
      setState({ status: "anonymous", user: null });
    }
  }, []);

  useEffect(() => {
    let alive = true;

    authApi
      .me()
      .then((user) => alive && setState({ status: "authenticated", user }))
      .catch(() => alive && setState({ status: "anonymous", user: null }));

    return () => {
      alive = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setState({ status: "anonymous", user: null });
  }, []);

  return { ...state, refresh, logout };
}
