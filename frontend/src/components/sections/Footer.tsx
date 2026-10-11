import Image from "next/image";
import Link from "next/link";
import { COMPANY } from "@/lib/company";

/** Tautan navigasi menunjuk section di beranda; dari halaman lain tetap sampai. */
const NAV_LINKS = [
  { label: "Beranda", href: "/#hero" },
  { label: "Tentang", href: "/#about" },
  { label: "Kurikulum", href: "/#value" },
  { label: "Kursus", href: "/courses" },
  { label: "FAQ", href: "/#faq" },
];

const LEGAL_LINKS = [
  { label: "Syarat & Ketentuan", href: "/syarat-ketentuan" },
  { label: "Kebijakan Privasi", href: "/kebijakan-privasi" },
  { label: "Pengembalian Dana", href: "/pengembalian-dana" },
  { label: "Kontak", href: "/kontak" },
];

/**
 * Akun resmi SynapEd.
 *
 * Sebelumnya di sini ada ikon Twitter dan GitHub yang keduanya `href="#"` —
 * hiasan yang tidak menunjuk akun mana pun. Ikon media sosial yang tidak bisa
 * diklik lebih buruk daripada tidak ada: ia menjanjikan kehadiran yang tidak
 * ada, dan itu justru diperiksa saat kelayakan merchant dinilai.
 */
const SOCIALS = [
  {
    label: "Instagram SynapEd",
    href: "https://www.instagram.com/synap.ed/",
    path: "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z",
  },
  {
    label: "YouTube SynapEd",
    href: "https://www.youtube.com/@SynapEducation",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
];

export default function Footer() {
  return (
    // Navy hangat menggantikan navy-kehitaman lama yang dingin —
    // tetap jadi jangkar gelap, tapi jelas biru SynapEd.
    <footer className="bg-footer pt-16 pb-8">
      <div className="container-page">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            {/* Rasio asli 667x667 — lihat catatan di Navbar.tsx */}
            <Image
              src="/images/logotextwhite.png"
              alt="SynapEd"
              width={667}
              height={667}
              className="w-28 h-auto -my-9 mb-1"
            />
            <p className="text-sm leading-relaxed max-w-xs mb-6 text-white">
              Platform pembelajaran online terlengkap yang terbuka untuk semua kalangan. Pelajari
              berbagai bidang ilmu dan kembangkan potensimu bersama SynapEd.
            </p>
            <div className="flex items-center gap-3">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  // Wajib untuk tautan yang membuka tab baru: tanpa noopener,
                  // halaman tujuan bisa menjangkau window pembukanya lewat
                  // window.opener dan mengalihkannya.
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-white/15 text-white/70 transition-colors duration-200 ease-out-soft hover:border-blue-300 hover:text-blue-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={s.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className="t-label text-white mb-5">Navigasi</h2>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 hover:text-blue-300 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Dulu kolom "Materi" berisi lima kategori yang dipatok di kode dan
              semuanya href="#". Kategori sekarang dikelola admin lewat panel,
              jadi daftar tetap di sini pasti melenceng dari isi katalog. Diganti
              dokumen legal - yang justru dicari peninjau pembayaran. */}
          <div>
            <h2 className="t-label text-white mb-5">Informasi</h2>
            <ul className="flex flex-col gap-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 hover:text-blue-300 transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Identitas penyelenggara — bagian "Legal Notice" pada template
            Midtrans, dan hal pertama yang dicari saat menilai kelayakan
            merchant: siapa yang bertanggung jawab, dan di mana. */}
        <div className="mb-10 text-sm text-white/70 leading-relaxed max-w-2xl">
          <p className="text-white font-medium mb-1">
            {COMPANY.name} - {COMPANY.legalName}
          </p>
          <p>{COMPANY.address}</p>
          <p className="mt-2">
            <a href={`mailto:${COMPANY.supportEmail}`} className="hover:text-blue-300 transition-colors">
              {COMPANY.supportEmail}
            </a>
            {" · "}
            <a href={`tel:${COMPANY.phoneHref}`} className="hover:text-blue-300 transition-colors">
              {COMPANY.phone}
            </a>
          </p>
          <p className="text-white/50">{COMPANY.supportHours}</p>
        </div>

        <div className="h-px mb-8 bg-white" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60">
          <span>© {new Date().getFullYear()} SynapEd. Learn Anything, Anytime.</span>
          <div className="flex items-center gap-6">
            <Link href="/kebijakan-privasi" className="hover:text-blue-300 transition-colors duration-200">
              Kebijakan Privasi
            </Link>
            <Link href="/syarat-ketentuan" className="hover:text-blue-300 transition-colors duration-200">
              Syarat &amp; Ketentuan
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
