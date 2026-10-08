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

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { status, user } = useAuth();

  const isHome = pathname === "/";
  const activeId = useActiveSection(SECTION_IDS, isHome);

  /**
   * Apakah hero yang gelap masih berada TEPAT di belakang navbar?
   *
   * Satu-satunya permukaan gelap di aplikasi ini adalah hero beranda
   * (`bg-hero-navy`); seluruh section lain dan seluruh halaman lain memakai
   * `bg-paper` yang krem terang.
   *
   * Diukur dari geometri hero, bukan dari "section mana yang sedang aktif".
   * Dua cara itu terlihat setara padahal tidak: penanda section aktif memakai
   * IntersectionObserver yang berpindah ke section berikutnya saat section itu
   * baru menyentuh tengah layar — sekitar 150px SEBELUM hero benar-benar lewat
   * dari belakang navbar. Selama pita itu, logo gelap tergambar di atas biru.
   */
  const [overDarkHero, setOverDarkHero] = useState(false);
  const light = !overDarkHero;

  useEffect(() => {
    // Titik tengah kapsul navbar secara vertikal — bukan tepi bawahnya.
    //
    // Peralihan warna diambil di titik ini karena logo dan teks memang duduk di
    // sana. Memakai tepi bawah (84) membuat warnanya berganti terlalu cepat:
    // saat hero tinggal menyisakan 80px, ia masih menutupi hampir seluruh
    // navbar, tetapi logonya sudah berubah gelap di atas biru.
    const NAVBAR_MID = 48;

    const onScroll = () => {
      setScrolled(window.scrollY > 24);

      // Hero gelap mana pun, ditandai lewat atribut `data-dark-hero`.
      //
      // Halaman kelas membuka dengan pita biru penuh, dan tanpa ini logo
      // putihnya tergambar di atas kertas krem begitu hero terlewat —
      // atau logo gelap di atas biru sejak awal. Ditandai lewat atribut,
      // bukan daftar rute, supaya halaman berikutnya tidak perlu
      // mendaftarkan dirinya di berkas ini. Hero beranda kini berlatar
      // ivory (terang), jadi TIDAK ikut dihitung.
      const hero = document.querySelector("[data-dark-hero]");
      setOverDarkHero(hero ? hero.getBoundingClientRect().bottom > NAVBAR_MID : false);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

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
            ? "bg-paper/10 backdrop-blur-xl border-0 shadow-soft"
            : light
              ? "bg-paper-card/0 backdrop-blur-md border-0"
              : "bg-white/10 backdrop-blur-md border-white/15",
        )}
      >
        {/* Aset logo berukuran 667x667 (persegi) dengan margin transparan tebal.
            width/height WAJIB sesuai rasio asli, kalau tidak gambarnya dipipihkan.
            Ukuran optis diatur lewat lebar CSS, lalu -my menetralkan tinggi
            kanvas kosong supaya baris navbar tidak ikut membesar. */}
        <Link href="/" className="flex items-center shrink-0" aria-label="SynapEd — beranda">
          <Image
            src={light ? "/images/logotext.png" : "/images/logotextwhite.png"}
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
                  "relative px-3.5 py-2 rounded-full text-sm",
                  "transition-colors duration-200 ease-out-soft",
                  link.sempit && "hidden lg:block",
                  // Keping section aktif sama di kedua latar: teks biru tua di
                  // atas keping biru muda cukup kontras baik di kertas maupun
                  // di atas navy. Hanya keadaan tidak-aktif yang berbeda.
                  isActive
                    ? "text-blue-700 bg-blue-50"
                    : light
                      ? "text-ink-body hover:text-blue-700 hover:bg-blue-50/60"
                      : "text-white hover:text-blue-700 hover:bg-blue-50/60",
                )}
              >
                {link.label}
              </Tag>
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
                      ? "text-amber-700 hover:bg-amber-100"
                      : "text-amber-500 hover:text-white hover:bg-white/8",
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
                      ? "border-rule text-ink-body hover:border-blue-500 hover:text-blue-700"
                      : "border-white/25 text-white hover:bg-white/10",
                  )}
                >
                  Jadi Educator
                </Link>
              )}

              {/* Dua pintu ke panel educator, ditulis sekali lewat map.

                  Sebelumnya hanya "Kursus Saya" dan ia ditulis tangan. Menambah
                  tujuan kedua dengan cara yang sama berarti gaya tombolnya harus
                  dijaga sama di dua tempat — dan yang tertinggal baru terlihat
                  saat keduanya kebetulan tampil bersebelahan. */}
              {user.role === "educator" &&
                [
                  { href: "/educator/courses", label: "Kursus Saya", sempit: true },
                  { href: "/educator/classes", label: "Kelas Saya", sempit: false },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-full border whitespace-nowrap",
                      "transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
                      // Di lebar tablet kapsul navbar sudah penuh oleh lima
                      // tautan bagian; tombol kedua mendorong foto profil ke
                      // luar layar. Diukur, bukan ditebak: pada 820px dengan
                      // dua tombol, avatarnya benar-benar terpotong.
                      //
                      // Yang disembunyikan tetap terjangkau — panel educator
                      // punya kedua tab, dan menu lipat di bawah md memuat
                      // keduanya.
                      item.sempit ? "" : "hidden lg:block",
                      light
                        ? "border-rule text-ink-body hover:border-blue-500 hover:text-blue-700"
                        : "border-white/25 text-white hover:bg-white/10",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}

              {/* Dashboard untuk SEMUA akun — kontributor kursus tidak harus
                  educator. Baru tampil di xl: di bawahnya kapsul navbar sudah
                  penuh, dan dashboard tetap terjangkau dari halaman profil
                  serta menu lipat. */}
              <Link
                href="/dashboard"
                className={cn(
                  "hidden xl:block px-4 py-2 text-sm font-medium rounded-full border whitespace-nowrap",
                  "transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
                  light
                    ? "border-rule text-ink-body hover:border-blue-500 hover:text-blue-700"
                    : "border-white/25 text-white hover:bg-white/10",
                )}
              >
                Dashboard
              </Link>

              {/* Foto profil sebagai tombol. Lebih jelas bisa diklik daripada
                  nama polos, dan tombol Keluar pindah ke halaman profil supaya
                  navbar tidak menaruh aksi merusak di sebelah tautan biasa. */}
              <Link
                href="/profil"
                title={`${user.email} — buka profil`}
                aria-label="Buka profil"
                className={cn(
                  "rounded-full transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
                  "focus:outline-none focus-visible:ring-2",
                  light
                    ? "hover:ring-2 hover:ring-blue-500/30 focus-visible:ring-blue-500/40"
                    : "ring-offset-0 hover:ring-2 hover:ring-white/40 focus-visible:ring-white/60",
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
                    ? "text-ink-body hover:text-blue-700 hover:bg-blue-50/60"
                    : "text-white hover:text-blue-700 hover:bg-blue-50/60",
                )}
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className={cn(
                  "group inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-full",
                  "transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
                  // Kedua keadaan hover sengaja tetap kontras: sebelumnya versi
                  // terang menuju bg-white padahal teksnya putih, dan versi
                  // gelap menuju bg-blue-700 padahal teksnya biru — dua-duanya
                  // membuat tombolnya hilang tepat saat kursor menyentuhnya.
                  light
                    ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lift"
                    : "bg-white text-blue-600 hover:bg-blue-50 hover:shadow-soft",
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
            light ? "text-ink hover:bg-blue-50" : "text-paper hover:bg-white/10",
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
            {NAV_LINKS.map((link, i) => {
              const Tag = link.href ? Link : "a";
              const href = link.href ?? (isHome ? `#${link.id}` : `/#${link.id}`);

              return (
                <Tag
                  key={link.id}
                  href={href}
                  className="rise-in block text-sm text-ink-body hover:text-blue-700 hover:bg-blue-50/60 rounded-xl px-3 py-2.5 transition-colors"
                  style={{ "--rise-delay": `${i * 40}ms` } as React.CSSProperties}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Tag>
              );
            })}
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

                  {user.role === "educator" &&
                    [
                      { href: "/educator/courses", label: "Kursus Saya" },
                      { href: "/educator/classes", label: "Kelas Saya" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="px-6 py-3 text-sm font-medium rounded-xl text-center border border-rule text-ink hover:border-blue-500 hover:text-blue-700 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}

                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="px-6 py-3 text-sm font-medium rounded-xl text-center border border-rule text-ink hover:border-blue-500 hover:text-blue-700 transition-colors"
                  >
                    Dashboard
                  </Link>

                  {/* Tidak ada tombol Keluar di sini — keluar dilakukan dari
                      halaman profil, sejalan dengan navbar desktop. */}
                  <Link
                    href="/profil"
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
