"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

/**
 * Keluar dari akun.
 *
 * Sejak navbar memakai ikon profil, ini satu-satunya jalan keluar — sengaja
 * ditaruh di halaman profil, bukan di navbar, supaya aksi yang mengakhiri sesi
 * tidak bersebelahan dengan tautan navigasi biasa yang sering ditekan.
 */
export default function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await logout();
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700 disabled:opacity-60"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      {pending ? "Keluar…" : "Keluar"}
    </button>
  );
}
