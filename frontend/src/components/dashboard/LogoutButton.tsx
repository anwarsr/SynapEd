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
      className="group inline-flex items-center gap-4 bg-white/[0.06] px-6 py-3.5 text-[11.5px] font-semibold uppercase tracking-[0.26em] text-white/80 transition-colors duration-500 ease-warm hover:bg-rust-700 hover:text-[#fff] disabled:opacity-60"
    >
      {pending ? "Keluar…" : "Keluar"}
      <svg
        className="h-3.5 w-3.5 transition-transform duration-500 ease-warm group-hover:translate-x-1"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    </button>
  );
}
