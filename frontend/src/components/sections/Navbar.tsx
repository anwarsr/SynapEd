"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import UserAvatar from "@/components/ui/UserAvatar";
import { useActiveSection } from "@/lib/useActiveSection";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { label: "Beranda", id: "hero" },
  { label: "Tentang", id: "about" },
  { label: "Kurikulum", id: "value" },
  { label: "Kursus", id: "courses" },
  { label: "FAQ", id: "faq" },
];

const SECTION_IDS = NAV_LINKS.map((l) => l.id);

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { status, user } = useAuth();

  const isHome = pathname === "/";
  // Hanya beranda yang punya hero navy; halaman lain berlatar kertas terang.
  const light = isHome && !scrolled;
  const activeId = useActiveSection(SECTION_IDS, isHome);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // Kapsul mengambang, bukan bilah penuh — memberi navbar bentuk sendiri
    // sekaligus mengangkat logo dari latar navy supaya "Ed" biru terbaca.
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pt-3 sm:pt-4">
      <div
        className={cn(
          "container-nav rounded-3xl border px-4 sm:px-5 py-2.5",
          "flex items-center justify-between gap-4",
          "transition-[background-color,border-color,box-shadow] duration-300 ease-out-soft",
          scrolled
            ? "bg-paper/92 backdrop-blur-xl border-rule shadow-soft"
            : light
              ? "bg-white/10 backdrop-blur-md border-white/15"
              : "bg-paper-card/70 backdrop-blur-md border-rule",
        )}
      >
        {/* Aset logo berukuran 667x667 (persegi) dengan margin transparan tebal.
            width/height WAJIB sesuai rasio asli, kalau tidak gambarnya dipipihkan.
            Ukuran optis diatur lewat lebar CSS, lalu -my menetralkan tinggi
            kanvas kosong supaya baris navbar tidak ikut membesar. */}
        <Link href="/" className="flex items-center shrink-0" aria-label="SynapEd — beranda">
          <Image
            src={light ? "/images/logotextwhite.png" : "/images/logotext.png"}
            alt="SynapEd"
            width={667}
            height={667}
            className="w-24 sm:w-28 h-auto -my-8"
            priority
          />
        </Link>

        {/* Link + penanda section aktif */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const href = isHome ? `#${link.id}` : `/#${link.id}`;
            const isActive = isHome && activeId === link.id;

            return (
              <a
                key={link.id}
                href={href}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative px-3.5 py-2 rounded-full text-sm",
                  "transition-colors duration-200 ease-out-soft",
                  light
                    ? isActive
                      ? "text-white bg-white/12"
                      : "text-blue-100/80 hover:text-white hover:bg-white/8"
                    : isActive
                      ? "text-blue-700 bg-blue-50"
                      : "text-ink-body hover:text-blue-700 hover:bg-blue-50/60",
                )}
              >
                {link.label}
                {/* Titik penanda — sinyal halus, tidak menggeser tata letak */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 bottom-0.5 w-1 h-1 rounded-full",
                    "transition-all duration-300 ease-warm",
                    isActive ? "opacity-100 scale-100 bg-amber-500" : "opacity-0 scale-0",
                  )}
                />
              </a>
            );
          })}
        </div>

        {/* Slot lebar tetap: status auth baru diketahui setelah Firebase
            menjawab, dan tanpa ini kapsul akan bergeser saat datanya masuk. */}
        <div className="hidden md:flex items-center justify-end gap-2 shrink-0 min-w-[13rem]">
          {status === "loading" ? (
            <span aria-hidden="true" className="h-9 w-36 rounded-full bg-current opacity-[0.07]" />
          ) : status === "authenticated" ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-full",
                    "transition-colors duration-200 ease-out-soft",
                    // amber-500 hanya boleh dipakai sebagai teks di atas navy
                    // (5.8:1); di atas kertas ia gagal, jadi di sana amber-700.
                    light
                      ? "text-amber-500 hover:text-white hover:bg-white/8"
                      : "text-amber-700 hover:bg-amber-100",
                  )}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6l7-3z"
                    />
                  </svg>
                  Admin
                </Link>
              )}

              {/* Hanya pengguna biasa yang ditawari: admin meninjau pengajuan,
                  educator sudah menjadi educator. */}
              {user.role === "user" && (
                <Link
                  href="/educator"
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-full border",
                    "transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
                    light
                      ? "border-white/25 text-white hover:bg-white/10"
                      : "border-rule text-ink-body hover:border-blue-500 hover:text-blue-700",
                  )}
                >
                  Jadi Educator
                </Link>
              )}

              {user.role === "educator" && (
                <span
                  className={cn(
                    "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md",
                    light ? "bg-white/12 text-white" : "bg-amber-100 text-amber-700",
                  )}
                >
                  Educator
                </span>
              )}

              {/* Foto profil sebagai tombol. Lebih jelas bisa diklik daripada
                  nama polos, dan tombol Keluar pindah ke halaman profil supaya
                  navbar tidak menaruh aksi merusak di sebelah tautan biasa. */}
              <Link
                href="/dashboard"
                title={`${user.email} — buka profil`}
                aria-label="Buka profil"
                className={cn(
                  "rounded-full transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
                  "focus:outline-none focus-visible:ring-2",
                  light
                    ? "ring-offset-0 hover:ring-2 hover:ring-white/40 focus-visible:ring-white/60"
                    : "hover:ring-2 hover:ring-blue-500/30 focus-visible:ring-blue-500/40",
                )}
              >
                <UserAvatar name={user.name} photoURL={user.photoURL} size="sm" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ease-out-soft",
                  light
                    ? "text-blue-100/90 hover:text-white hover:bg-white/8"
                    : "text-ink-body hover:text-blue-700 hover:bg-blue-50/60",
                )}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className={cn(
                  "group inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-full",
                  "transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
                  light
                    ? "bg-paper text-navy hover:bg-white hover:shadow-lift"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-soft",
                )}
              >
                Daftar Gratis
                <svg
                  className="w-3.5 h-3.5 -mr-0.5 transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </>
          )}
        </div>

        <button
          className={cn(
            "md:hidden p-1.5 rounded-full transition-colors",
            light ? "text-paper hover:bg-white/10" : "text-ink hover:bg-blue-50",
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
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

      {/* Menu mobile — kartu terpisah di bawah kapsul */}
      {mobileOpen && (
        <div className="md:hidden max-w-7xl mx-auto mt-2 bg-paper-card border border-rule rounded-3xl shadow-lift overflow-hidden">
          <div className="px-5 py-4 space-y-0.5">
            {NAV_LINKS.map((link, i) => (
              <a
                key={link.id}
                href={isHome ? `#${link.id}` : `/#${link.id}`}
                className="rise-in block text-sm text-ink-body hover:text-blue-700 hover:bg-blue-50/60 rounded-xl px-3 py-2.5 transition-colors"
                style={{ "--rise-delay": `${i * 40}ms` } as React.CSSProperties}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <hr className="rule-line my-3" />
            <div className="flex flex-col gap-2">
              {status === "authenticated" ? (
                <>
                  <span className="flex items-center gap-3 px-3 pb-2">
                    <UserAvatar name={user.name} photoURL={user.photoURL} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink truncate">{user.name}</span>
                      <span className="block text-xs text-ink-muted truncate">{user.email}</span>
                    </span>
                  </span>

                  {user.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="px-6 py-3 text-sm font-medium rounded-xl text-center border border-amber-500/40 text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      Panel Admin
                    </Link>
                  )}

                  {user.role === "user" && (
                    <Link
                      href="/educator"
                      onClick={() => setMobileOpen(false)}
                      className="px-6 py-3 text-sm font-medium rounded-xl text-center border border-rule text-ink hover:border-blue-500 hover:text-blue-700 transition-colors"
                    >
                      Jadi Educator
                    </Link>
                  )}

                  {/* Tidak ada tombol Keluar di sini — keluar dilakukan dari
                      halaman profil, sejalan dengan navbar desktop. */}
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="px-6 py-3 text-sm font-semibold rounded-xl text-center bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Profil Saya
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-6 py-3 text-sm font-medium rounded-xl text-center border border-rule text-ink hover:border-blue-500 hover:text-blue-700 transition-colors"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/register"
                    className="px-6 py-3 text-sm font-semibold rounded-xl text-center bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Daftar Gratis
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
