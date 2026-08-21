import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import { COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/company";

/**
 * Kerangka bersama untuk keempat halaman legal.
 *
 * Satu komponen, bukan empat salinan: halaman-halaman ini saling menautkan dan
 * sama-sama menampilkan tanggal berlaku serta identitas penyelenggara. Ditulis
 * terpisah, perbedaan kecil di antaranya akan terbaca sebagai dokumen yang
 * tidak konsisten — hal terakhir yang diinginkan pada teks yang mengikat.
 */

const LEGAL_LINKS = [
  { href: "/syarat-ketentuan", label: "Syarat & Ketentuan" },
  { href: "/kebijakan-privasi", label: "Kebijakan Privasi" },
  { href: "/pengembalian-dana", label: "Pengembalian Dana" },
  { href: "/kontak", label: "Kontak" },
];

export function LegalPage({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: string;
  /** Path halaman ini, supaya tautannya sendiri tidak bisa diklik. */
  current: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-32 pb-24">
        <div className="container-reading">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-8">
            <Link href="/" className="hover:text-blue-700 transition-colors">
              Beranda
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink">{title}</span>
          </nav>

          <h1 className="t-display mb-6">{title}</h1>

          <p className="t-body text-ink-muted mb-2">{intro}</p>

          <p className="text-sm text-ink-faint mb-10">
            Berlaku sejak {LEGAL_EFFECTIVE_DATE} · Diterbitkan oleh {COMPANY.name} ({COMPANY.legalName})
          </p>

          <span className="rule-accent mb-10 block" aria-hidden="true" />

          <div className="space-y-8">{children}</div>

          {/* Tautan silang antar dokumen — ketiganya saling merujuk di isinya,
              jadi pembaca harus bisa berpindah tanpa kembali ke footer. */}
          <div className="mt-16 pt-8 border-t border-rule">
            <h2 className="t-label mb-4">Dokumen lain</h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {LEGAL_LINKS.filter((l) => l.href !== current).map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-blue-700 hover:underline underline-offset-4"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

/** Satu pasal bernomor. */
export function Clause({
  no,
  title,
  children,
}: {
  no: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="t-h3 text-lg mb-3">
        <span className="t-numeral text-ink-muted mr-2">{no}.</span>
        {title}
      </h2>
      <div className="t-body space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

/** Daftar berpoin dengan gaya yang sama di seluruh dokumen. */
export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 marker:text-blue-500">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
