"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import UserAvatar from "@/components/ui/UserAvatar";
import { useActiveSection } from "@/lib/useActiveSection";
import { useAuth } from "@/lib/useAuth";
import { cn } from "@/lib/cn";

/**
 * `href` menandai tautan RUTE; tanpanya, tautan itu jangkar ke section
 * beranda.
 *
 * "Kelas" menggantikan "Kurikulum" atas permintaan pemilik proyek. Section
 * kurikulumnya sendiri tetap ada di beranda — yang dilepas hanya pintu
 * masuknya di navbar.
 */
/**
 * `sempit: true` berarti tautan ini DISEMBUNYIKAN di kapsul desktop sampai
 * lebar lg. Kapsulnya sudah penuh di lebar tablet: diukur di 820px, menambah
 * satu tautan mendorong tombol "Daftar Gratis" keluar layar (846px dari 820px
 * yang tersedia). Yang disembunyikan tetap terjangkau — menu lipat memuat
 * seluruh tautan tanpa kecuali.
 */
const NAV_LINKS: readonly { label: string; id: string; href?: string; sempit?: boolean }[] = [
  { label: "Beranda", id: "hero" },
  { label: "Tentang", id: "about" },
  { label: "Kelas", id: "kelas", href: "/kelas" },
  { label: "Kursus", id: "courses" },
  { label: "Lab", id: "lab", href: "/lab", sempit: true },
  { label: "FAQ", id: "faq" },
];

// HANYA yang benar-benar section. Mengikutkan tautan rute membuat
// useActiveSection memasang IntersectionObserver pada elemen yang tidak
// pernah ada, dan penanda aktifnya diam-diam berhenti bekerja.
const SECTION_IDS = NAV_LINKS.filter((l) => !l.href).map((l) => l.id);

/** Tautan sekunder: teks polos TANPA kotak. Hover = garis tipis melebar dari tengah di bawah kata,
 *  huruf sedikit merenggang (.nav-aksi di globals.css). */
const PIL = "nav-aksi px-3 py-2 text-sm font-medium whitespace-nowrap text-white/85 hover:text-white";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { status, user } = useAuth();

  const isHome = pathname === "/";
  const activeId = useActiveSection(SECTION_IDS, isHome);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // Kapsul kaca mengambang. Seluruh situs gelap, jadi navbar selalu gelap
    // dengan logo putih. Tanpa garis tepi: kedalaman datang dari kaca buram
    // (makin pekat saat di-scroll) dan bayangan lembut.
    <nav className="fixed left-0 right-0 top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4">
      <div
        className={cn(
          "container-nav flex items-center justify-between gap-4 rounded-full px-5 py-2 sm:px-6",
          "transition-[background-color,box-shadow] duration-500 ease-out-soft",
          scrolled
            ? "bg-white/[0.14] shadow-[0_14px_44px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            : "bg-white/[0.08] backdrop-blur-md",
        )}
      >
        {/* Aset logo berukuran 667x667 (persegi) dengan margin transparan tebal.
            width/height WAJIB sesuai rasio asli, kalau tidak gambarnya dipipihkan.
            Ukuran optis diatur lewat lebar CSS, lalu -my menetralkan tinggi
            kanvas kosong supaya baris navbar tidak ikut membesar. */}
        <Link href="/" className="flex shrink-0 items-center" aria-label="SynapEd - beranda">
          <Image
            src="/images/logotextwhite.png"
            alt="SynapEd"
            width={667}
            height={667}
            className="logo-on-dark -my-8 h-auto w-24 sm:w-28"
            priority
          />
          <Image
            src="/images/logotext.png"
            alt="SynapEd"
            width={667}
            height={667}
            className="logo-on-light -my-8 h-auto w-24 sm:w-28"
          />
        </Link>

        {/* Tautan + penanda section aktif: garis kecil di bawah kata, bukan keping berlatar */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const rute = link.href;
            const href = rute ?? (isHome ? `#${link.id}` : `/#${link.id}`);
            const isActive = rute
              ? pathname === rute || pathname.startsWith(`${rute}/`)
              : isHome && activeId === link.id;

            // next/link untuk rute, <a> untuk jangkar: Link melakukan
            // navigasi klien dan prefetch, sedangkan jangkar dalam halaman
            // justru rusak kalau dilewatkan router.
            const Tag = rute ? Link : "a";

            return (
              <Tag
                key={link.id}
                href={href}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "group relative px-3.5 py-2 text-sm font-medium",
                  "transition-colors duration-300 ease-out-soft",
                  link.sempit && "hidden lg:block",
                  isActive ? "text-white" : "text-white/60 hover:text-white",
                )}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-0.5 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-blue-400 transition-[width,opacity] duration-300 ease-out-soft",
                    isActive ? "w-4 opacity-100" : "w-0 opacity-0 group-hover:w-2 group-hover:opacity-70",
                  )}
                />
              </Tag>
            );
          })}
        </div>

        {/* Slot lebar tetap: status auth baru diketahui setelah Firebase
            menjawab, dan tanpa ini kapsul akan bergeser saat datanya masuk. */}
        <div className="hidden min-w-[13rem] shrink-0 items-center justify-end gap-2 md:flex">
          {status === "loading" ? (
            <span aria-hidden="true" className="h-9 w-36 rounded-full bg-white/10" />
          ) : status === "authenticated" ? (
            <>
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="group inline-flex items-center rounded-full px-3.5 py-2 text-sm font-bold"
                >
                  {/* Hover: hanya tulisannya yang membesar; latar tombol tidak berubah */}
                  <span className="admin-kilau inline-block origin-center transition-transform duration-300 ease-warm group-hover:scale-[1.18]">Admin</span>
                </Link>
              )}

              {/* Hanya pengguna biasa yang ditawari: admin meninjau pengajuan,
                  educator sudah menjadi educator. */}
              {user.role === "user" && (
                <Link href="/educator" className={PIL}>
                  Jadi Educator
                </Link>
              )}

              {/* Dua pintu ke panel educator, ditulis sekali lewat map.

                  Di lebar tablet kapsul navbar sudah penuh oleh lima tautan
                  bagian; tombol kedua mendorong foto profil ke luar layar.
                  Diukur, bukan ditebak: pada 820px dengan dua tombol, avatarnya
                  benar-benar terpotong. Yang disembunyikan tetap terjangkau -
                  panel educator punya kedua tab, dan menu lipat di bawah md
                  memuat keduanya. */}
              {(user.role === "educator" || user.role === "admin") &&
                [
                  { href: "/educator/courses", label: "Kursus Saya", sempit: true },
                  { href: "/educator/classes", label: "Kelas Saya", sempit: false },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className={cn(PIL, !item.sempit && "hidden lg:block")}>
                    {item.label}
                  </Link>
                ))}

              {/* Dashboard untuk SEMUA akun — kontributor kursus tidak harus
                  educator. Baru tampil di xl: di bawahnya kapsul navbar sudah
                  penuh, dan dashboard tetap terjangkau dari halaman profil
                  serta menu lipat. */}
              <Link href="/dashboard" className={cn(PIL, "hidden xl:block")}>
                Dashboard
              </Link>

              {/* Foto profil sebagai tombol. Lebih jelas bisa diklik daripada
                  nama polos, dan tombol Keluar pindah ke halaman profil supaya
                  navbar tidak menaruh aksi merusak di sebelah tautan biasa. */}
              <Link
                href="/profil"
                title={`${user.email} - buka profil`}
                aria-label="Buka profil"
                className="foto-link block rounded-full focus:outline-none"
              >
                <UserAvatar name={user.name} photoURL={user.photoURL} size="sm" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors duration-200 ease-out-soft hover:text-white"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="group inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-paper transition-[background-color,transform] duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-white/90"
              >
                Daftar Gratis
                <svg
                  className="-mr-0.5 h-3.5 w-3.5 transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.25}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-full p-1.5 text-white transition-colors hover:bg-white/10 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          aria-expanded={mobileOpen}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Menu mobile — kartu kaca terpisah di bawah kapsul */}
      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-7xl overflow-hidden rounded-3xl bg-card-hover/85 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl md:hidden">
          <div className="space-y-0.5 px-5 py-4">
            {NAV_LINKS.map((link, i) => {
              const Tag = link.href ? Link : "a";
              const href = link.href ?? (isHome ? `#${link.id}` : `/#${link.id}`);

              return (
                <Tag
                  key={link.id}
                  href={href}
                  className="rise-in block rounded-xl px-3 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  style={{ "--rise-delay": `${i * 40}ms` } as React.CSSProperties}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Tag>
              );
            })}
            <div aria-hidden="true" className="my-3 h-px bg-white/10" />
            <div className="flex flex-col gap-2">
              {status === "authenticated" ? (
                <>
                  <span className="flex items-center gap-3 px-3 pb-2">
                    <UserAvatar name={user.name} photoURL={user.photoURL} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{user.name}</span>
                      <span className="block truncate text-xs text-white/55">{user.email}</span>
                    </span>
                  </span>

                  {user.role === "admin" && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="group rounded-xl bg-white/10 px-6 py-3 text-center text-sm font-bold"
                    >
                      <span className="admin-kilau inline-block origin-center transition-transform duration-300 ease-warm group-hover:scale-[1.12]">Panel Admin</span>
                    </Link>
                  )}

                  {user.role === "user" && (
                    <Link
                      href="/educator"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl bg-white/10 px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-white/15"
                    >
                      Jadi Educator
                    </Link>
                  )}

                  {(user.role === "educator" || user.role === "admin") &&
                    [
                      { href: "/educator/courses", label: "Kursus Saya" },
                      { href: "/educator/classes", label: "Kelas Saya" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-xl bg-white/10 px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-white/15"
                      >
                        {item.label}
                      </Link>
                    ))}

                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl bg-white/10 px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-white/15"
                  >
                    Dashboard
                  </Link>

                  {/* Tidak ada tombol Keluar di sini — keluar dilakukan dari
                      halaman profil, sejalan dengan navbar desktop. */}
                  <Link
                    href="/profil"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Profil Saya
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-xl bg-white/10 px-6 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-white/15"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-xl bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
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
