"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import type { SessionUser } from "@/lib/firebase/session";

/**
 * Kerangka halaman khusus admin.
 *
 * Sengaja TIDAK memakai Navbar dan Footer situs publik: keduanya penuh tautan
 * Kursus, Kurikulum, dan materi — isi yang tidak ada hubungannya dengan
 * pekerjaan admin dan hanya jadi gangguan di sini. Panel ini berdiri sendiri.
 *
 * `user` datang dari server (requireAdmin) supaya nama admin langsung tampil
 * pada render pertama, tanpa menunggu Firebase menjawab di browser.
 */
export default function AdminShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      {/* Bilah padat, bukan kapsul mengambang seperti di situs publik —
          panel kerja butuh titik acuan yang tenang, bukan yang menonjol. */}
      <header className="sticky top-0 z-50 bg-paper-card/95 backdrop-blur-md border-b border-rule">
        <div className="container-page flex items-center justify-between gap-4 py-2.5">
          <Link href="/admin" className="flex items-center gap-3 min-w-0" aria-label="Panel Admin SynapEd">
            {/* Rasio asli 667x667 — lihat catatan di Navbar.tsx */}
            <Image
              src="/images/logotext.png"
              alt="SynapEd"
              width={667}
              height={667}
              className="w-24 h-auto -my-8 shrink-0"
              priority
            />
            <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wider">
              Panel Admin
            </span>
          </Link>

          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:block text-sm text-ink-muted truncate max-w-[14rem]" title={user.email}>
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
        <div className="container-page text-xs text-ink-muted">
          SynapEd · Panel Admin
        </div>
      </footer>
    </div>
  );
}
