import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Link from "next/link";
import { COMPANY, LEGAL_EFFECTIVE_DATE } from "@/lib/company";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontak – SynapEd",
  description: `Hubungi ${COMPANY.name}: ${COMPANY.supportEmail}, ${COMPANY.phone}, ${COMPANY.supportHours}.`,
};

/**
 * Halaman ini tidak memakai kerangka LegalPage.
 *
 * Isinya bukan pasal-pasal melainkan data yang harus terbaca sekilas — email,
 * telepon, alamat, jam layanan. Peninjau Midtrans mencari keempatnya, dan
 * pembeli yang sedang kesulitan tidak sedang ingin membaca dokumen.
 */

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-rule rounded-2xl bg-paper-card p-6">
      <h2 className="t-label mb-3">{label}</h2>
      <div className="t-body text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

export default function KontakPage() {
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
            <span className="text-ink">Kontak</span>
          </nav>

          <h1 className="t-display mb-6">Hubungi Kami</h1>

          <p className="t-body text-ink-muted mb-10 max-w-2xl">
            Ada pertanyaan tentang kursus, pembayaran, atau akun Anda? Kami siap membantu pada jam
            layanan di bawah.
          </p>

          <span className="rule-accent mb-10 block" aria-hidden="true" />

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Item label="Email dukungan">
              <a
                href={`mailto:${COMPANY.supportEmail}`}
                className="text-blue-700 hover:underline underline-offset-4"
              >
                {COMPANY.supportEmail}
              </a>
              <p className="text-sm text-ink-muted mt-2">
                Pertanyaan kursus, kendala akses, dan keluhan pembelian.
              </p>
            </Item>

            <Item label="Telepon / WhatsApp">
              <a
                href={`tel:${COMPANY.phoneHref}`}
                className="text-blue-700 hover:underline underline-offset-4"
              >
                {COMPANY.phone}
              </a>
              <p className="text-sm text-ink-muted mt-2">{COMPANY.supportHours}</p>
            </Item>

            <Item label="Data pribadi">
              <a
                href={`mailto:${COMPANY.privacyEmail}`}
                className="text-blue-700 hover:underline underline-offset-4"
              >
                {COMPANY.privacyEmail}
              </a>
              <p className="text-sm text-ink-muted mt-2">
                Permintaan akses, koreksi, atau penghapusan data pribadi Anda.
              </p>
            </Item>

            <Item label="Jam layanan">
              <p>{COMPANY.supportHours}</p>
              <p className="text-sm text-ink-muted mt-2">
                Pesan yang masuk di luar jam tersebut kami tanggapi pada hari kerja berikutnya.
              </p>
            </Item>
          </div>

          <Item label="Alamat">
            <p className="font-medium text-ink mb-1">
              {COMPANY.name} ({COMPANY.legalName})
            </p>
            <p>{COMPANY.address}</p>
          </Item>

          <div className="mt-16 pt-8 border-t border-rule">
            <h2 className="t-label mb-4">Dokumen lain</h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {[
                { href: "/syarat-ketentuan", label: "Syarat & Ketentuan" },
                { href: "/kebijakan-privasi", label: "Kebijakan Privasi" },
                { href: "/pengembalian-dana", label: "Pengembalian Dana" },
              ].map((l) => (
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
            <p className="text-sm text-ink-faint mt-6">Diperbarui {LEGAL_EFFECTIVE_DATE}</p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
