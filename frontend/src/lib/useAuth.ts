"use client";
import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
}

type State =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous"; user: null };

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    name: u.displayName ?? u.email?.split("@")[0] ?? "Pengguna",
    email: u.email ?? "",
  };
}

/**
 * Status sesi untuk komponen klien.
 *
 * onAuthStateChanged menjawab dari cache lokal Firebase, jadi jauh lebih cepat
 * daripada memanggil server. Sumber kebenaran untuk halaman terproteksi tetap
 * session cookie yang diverifikasi di server (lihat lib/firebase/session.ts) —
 * hook ini hanya untuk tampilan, seperti nama di navbar.
 */
export function useAuth() {
  const [state, setState] = useState<State>({ status: "loading", user: null });

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth(), (u) => {
      setState(u ? { status: "authenticated", user: toAuthUser(u) } : { status: "anonymous", user: null });
    });
  }, []);

  const logout = useCallback(async () => {
    // Dua langkah: cabut sesi server (cookie httpOnly) lalu keluar dari
    // SDK klien. Melewatkan salah satunya membuat status jadi tidak sinkron.
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    await signOut(firebaseAuth()).catch(() => undefined);
    setState({ status: "anonymous", user: null });
  }, []);

  return { ...state, logout };
}
