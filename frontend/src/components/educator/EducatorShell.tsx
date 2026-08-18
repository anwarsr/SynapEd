"use client";
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

            <nav className="flex items-center gap-1" aria-label="Navigasi educator">
              <Link
                href="/educator/courses"
                aria-current={pathname.startsWith("/educator/courses") ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm whitespace-nowrap",
                  "transition-colors duration-200 ease-out-soft",
                  pathname.startsWith("/educator/courses")
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-ink-body hover:bg-blue-50/60 hover:text-blue-700",
                )}
              >
                Kursus Saya
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/educator"
              className="hidden sm:block text-sm text-ink-muted hover:text-blue-700 transition-colors whitespace-nowrap"
            >
              Profil Educator
            </Link>
            <span className="hidden sm:block text-sm text-ink-muted truncate max-w-[12rem]" title={user.email}>
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-semibold rounded-full bg-blue-600 text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 py-12">{children}</main>

      <footer className="border-t border-rule py-6">
        <div className="container-page text-xs text-ink-muted">SynapEd · Panel Educator</div>
      </footer>
    </div>
  );
}
