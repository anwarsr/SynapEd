"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import type { SessionUser } from "@/lib/firebase/session";
import type { AdminBadges } from "@/lib/adminBadges";
import { cn } from "@/lib/cn";

/**
 * `badge` menunjuk field mana di AdminBadges yang jadi angkanya. Ditulis
 * begini, bukan dicocokkan dari href di dalam JSX seperti dulu — waktu itu
 * lencananya diikat mati ke satu tautan, sehingga menambah tautan kedua yang
 * juga perlu lencana berarti menambah cabang if di tengah render.
 */
const NAV = [
  { href: "/admin", label: "Akun Pengguna" },
  { href: "/admin/categories", label: "Kategori" },
  { href: "/admin/notifications", label: "Pengajuan Edukator", badge: "applications" },
  { href: "/admin/course-requests", label: "Pengajuan Kursus", badge: "requests" },
  { href: "/admin/payments", label: "Pembayaran", badge: "payments" },
  // Tanpa lencana: ulasan tidak menunggu keputusan siapa pun, jadi tidak ada
  // angka yang berarti "belum dikerjakan".
  { href: "/admin/reviews", label: "Ulasan" },
  { href: "/admin/classes", label: "Kelas" },
] as const satisfies readonly {
  href: string;
  label: string;
  badge?: keyof AdminBadges;
}[];

/**
 * Kerangka halaman khusus admin.
 *
 * Sengaja TIDAK memakai Navbar dan Footer situs publik: keduanya penuh tautan
 * Kursus, Kurikulum, dan materi — isi yang tidak ada hubungannya dengan
 * pekerjaan admin dan hanya jadi gangguan di sini. Panel ini berdiri sendiri.
 *
 * `user` dan `badges` datang dari server supaya keduanya sudah benar pada
 * render pertama, tanpa menunggu jawaban dari browser.
 */
export default function AdminShell({
  user,
  badges,
  children,
}: {
  user: SessionUser;
  badges: AdminBadges;
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
      {/* Bilah padat, bukan kapsul mengambang seperti di situs publik —
          panel kerja butuh titik acuan yang tenang, bukan yang menonjol. */}
      <header className="sticky top-0 z-50 bg-paper-card/95 backdrop-blur-md border-b border-rule">
        <div className="container-page flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-5 min-w-0">
            <Link href="/admin" className="flex items-center gap-3 shrink-0" aria-label="Panel Admin SynapEd">
              {/* Rasio asli 667x667 — lihat catatan di Navbar.tsx */}
              <Image
                src="/images/logotext.png"
                alt="SynapEd"
                width={667}
                height={667}
                className="w-24 h-auto -my-8 shrink-0"
                priority
              />
              <span className="hidden lg:inline-flex items-center px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wider">
                Panel Admin
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Navigasi admin">
              {NAV.map((item) => {
                // Padanan persis: /admin tidak boleh ikut aktif saat berada
                // di /admin/notifications.
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin" || pathname.startsWith("/admin/users")
                    : pathname.startsWith(item.href);

                const menunggu = "badge" in item ? badges[item.badge] : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm whitespace-nowrap",
                      "transition-colors duration-200 ease-out-soft",
                      active
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-ink-body hover:bg-blue-50/60 hover:text-blue-700",
                    )}
                  >
                    {item.label}
                    {menunggu > 0 && (
                      <span
                        className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-700 text-white text-[10px] font-semibold"
                        aria-label={`${menunggu} pengajuan menunggu`}
                      >
                        {menunggu}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-3 min-w-0">
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

          <button
            className="lg:hidden p-1.5 rounded-full text-ink hover:bg-blue-50 transition-colors shrink-0"
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
          <div className="lg:hidden border-t border-rule bg-paper-card">
            <nav className="container-page py-3 flex flex-col gap-0.5" aria-label="Navigasi admin (mobile)">
              {NAV.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin" || pathname.startsWith("/admin/users")
                    : pathname.startsWith(item.href);

                const menunggu = "badge" in item ? badges[item.badge] : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm",
                      "transition-colors duration-200 ease-out-soft",
                      active
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-ink-body hover:bg-blue-50/60 hover:text-blue-700",
                    )}
                  >
                    {item.label}
                    {menunggu > 0 && (
                      <span
                        className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-700 text-white text-[10px] font-semibold"
                        aria-label={`${menunggu} pengajuan menunggu`}
                      >
                        {menunggu}
                      </span>
                    )}
                  </Link>
                );
              })}

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
        <div className="container-page text-xs text-ink-muted">SynapEd · Panel Admin</div>
      </footer>
    </div>
  );
}
