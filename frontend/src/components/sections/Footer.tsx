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

const socialPaths = [
  "M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z",
  "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z",
];

export default function Footer() {
  return (
    // Navy hangat menggantikan navy-kehitaman lama yang dingin —
    // tetap jadi jangkar gelap, tapi jelas biru SynapEd.
    <footer className="bg-hero-navy pt-16 pb-8">
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
              {socialPaths.map((d, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label={i === 0 ? "Twitter" : "GitHub"}
                  className="w-9 h-9 rounded-full flex items-center justify-center border border-white/15 text-blue-100/70 transition-colors duration-200 ease-out-soft hover:border-blue-300 hover:text-blue-300"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={d} />
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
                    className="text-sm text-blue-100/70 hover:text-blue-300 transition-colors duration-200"
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
              dokumen legal — yang justru dicari peninjau pembayaran. */}
          <div>
            <h2 className="t-label text-white mb-5">Informasi</h2>
            <ul className="flex flex-col gap-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-blue-100/70 hover:text-blue-300 transition-colors duration-200"
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
        <div className="mb-10 text-sm text-blue-100/70 leading-relaxed max-w-2xl">
          <p className="text-white font-medium mb-1">
            {COMPANY.name} — {COMPANY.legalName}
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
          <p className="text-blue-100/50">{COMPANY.supportHours}</p>
        </div>

        <div className="h-px mb-8 bg-white" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-blue-100/60">
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
