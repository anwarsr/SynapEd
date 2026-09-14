"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import type { SessionUser } from "@/lib/firebase/session";
import { cn } from "@/lib/cn";

/**
 * Kerangka halaman khusus educator, mengikuti pola AdminShell.
 *
 * Sengaja TIDAK memakai Navbar dan Footer situs publik: begitu educator
 * masuk ke sini, ia sedang bekerja mengelola kursus, bukan menjelajahi
 * katalog. `/educator` (pengajuan & status) tetap memakai kroma publik —
 * halaman itu juga dibuka oleh pengguna biasa yang belum jadi educator,
 * jadi panel kerja di sini belum pantas untuk mereka.
 */
/**
 * Tujuan navigasi, ditulis SEKALI.
 *
 * Menu desktop dan menu seluler merender daftar yang sama. Sebelumnya
 * keduanya ditulis tangan terpisah, dan itu aman selama tujuannya cuma satu —
 * begitu bertambah, tujuan kedua pasti akan ditambahkan ke salah satunya saja,
 * dan menu yang tertinggal hanya terlihat pada satu ukuran layar.
 *
 * Bentuknya mengikuti NAV di AdminShell.
 */
const NAV = [
  { href: "/educator/courses", label: "Kursus Saya" },
  { href: "/educator/classes", label: "Kelas Saya" },
  // Keluar dari panel educator — dashboard melayani semua akun, bukan hanya
  // educator — tapi penjualan kursus educator tinggal di sana.
  { href: "/dashboard", label: "Penjualan" },
] as const;

export default function EducatorShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <header className="sticky top-0 z-50 bg-paper-card/95 backdrop-blur-md border-b border-rule">
        <div className="container-page flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-5 min-w-0">
            <Link
              href="/educator/courses"
              className="flex items-center gap-3 shrink-0"
              aria-label="Panel Educator SynapEd"
            >
              {/* Rasio asli 667x667 — lihat catatan di Navbar.tsx */}
              <Image
                src="/images/logotext.png"
                alt="SynapEd"
                width={667}
                height={667}
                className="w-24 h-auto -my-8 shrink-0"
                priority
              />
              <span className="hidden lg:inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase tracking-wider">
                Panel Educator
              </span>
            </Link>

            <nav className="hidden sm:flex items-center gap-1" aria-label="Navigasi educator">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm whitespace-nowrap",
                    "transition-colors duration-200 ease-out-soft",
                    pathname.startsWith(item.href)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-ink-body hover:bg-blue-50/60 hover:text-blue-700",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden sm:flex items-center gap-3 min-w-0">
            <Link
              href="/educator"
              className="hidden lg:block text-sm text-ink-muted hover:text-blue-700 transition-colors whitespace-nowrap"
            >
              Profil Educator
            </Link>
            <span className="hidden lg:block text-sm text-ink-muted truncate max-w-[12rem]" title={user.email}>
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold rounded-full bg-blue-600 text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
            >
              Keluar
            </button>
          </div>

          <button
            className="sm:hidden p-1.5 rounded-full text-ink hover:bg-blue-50 transition-colors shrink-0"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileOpen}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Menu mobile — panel lipat di bawah bilah utama */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-rule bg-paper-card">
            <nav className="container-page py-3 flex flex-col gap-0.5" aria-label="Navigasi educator (mobile)">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-3 py-2.5 rounded-xl text-sm",
                    "transition-colors duration-200 ease-out-soft",
                    pathname.startsWith(item.href)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-ink-body hover:bg-blue-50/60 hover:text-blue-700",
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/educator"
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm text-ink-body hover:bg-blue-50/60 hover:text-blue-700 transition-colors"
              >
                Profil Educator
              </Link>

              <hr className="rule-line my-2" />

              <span className="px-3 pb-1 text-sm text-ink-muted truncate" title={user.email}>
                {user.name}
              </span>
              <button
                onClick={handleLogout}
                className="mx-3 px-4 py-2.5 text-sm font-semibold rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700"
              >
                Keluar
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 py-12">{children}</main>

      <footer className="border-t border-rule py-6">
        <div className="container-page text-xs text-ink-muted">SynapEd · Panel Educator</div>
      </footer>
    </div>
  );
}
