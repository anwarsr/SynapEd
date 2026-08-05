"use client";
import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase/client";
import { toRole, type Role } from "@/lib/roles";

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
}

type State =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous"; user: null };

async function toAuthUser(u: User): Promise<AuthUser> {
  // Tanpa refresh paksa; ini hanya untuk tampilan. Sumber kebenaran otorisasi
  // tetap pemeriksaan di server (requireAdmin), yang membaca claim dari
  // session cookie dan tidak bisa disiasati dari browser.
  const token = await u.getIdTokenResult().catch(() => null);

  return {
    uid: u.uid,
    name: u.displayName ?? u.email?.split("@")[0] ?? "Pengguna",
    email: u.email ?? "",
    photoURL: u.photoURL ?? null,
    role: toRole(token?.claims.role),
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
    let alive = true;

    const unsubscribe = onAuthStateChanged(firebaseAuth(), (u) => {
      if (!u) {
        if (alive) setState({ status: "anonymous", user: null });
        return;
      }
      // toAuthUser asinkron, jadi penjaga `alive` mencegah setState
      // setelah komponen dilepas.
      void toAuthUser(u).then((user) => {
        if (alive) setState({ status: "authenticated", user });
      });
    });

    return () => {
      alive = false;
      unsubscribe();
    };
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
