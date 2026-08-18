import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import CertificateCard from "@/components/certificates/CertificateCard";
import { getCertificate } from "@/lib/certificates";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ certificateId: string }>;
}

// Halaman kepercayaan publik — dibaca pihak ketiga (mis. HR) tanpa login,
// jadi harus selalu mencerminkan status TERKINI (termasuk pencabutan).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certificateId } = await params;
  return { title: `Verifikasi ${certificateId} – SynapEd` };
}

export default async function VerifyCertificatePage({ params }: Props) {
  const { certificateId } = await params;
  const certificate = await getCertificate(certificateId);
  const revoked = certificate?.revokedAt != null;

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-reading max-w-2xl">
          <p className="chapter-mark mb-5">
            <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
            <span>Verifikasi Sertifikat</span>
          </p>

          {!certificate ? (
            <div className="rounded-2xl border border-rule bg-paper-alt px-6 py-14 text-center">
              <p className="t-h3 text-lg mb-2">Sertifikat tidak ditemukan</p>
              <p className="text-sm text-ink-muted">
                Nomor <span className="t-numeral">{certificateId}</span> tidak cocok dengan sertifikat
                mana pun yang terbit di SynapEd. Periksa kembali penulisannya.
              </p>
            </div>
          ) : (
            <>
              <div
                className={
                  revoked
                    ? "mb-6 rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700"
                    : "mb-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700"
                }
              >
                {revoked ? "Sertifikat ini telah dicabut dan tidak lagi berlaku." : "Sertifikat ini sah dan diterbitkan oleh SynapEd."}
              </div>
              <CertificateCard certificate={certificate} />
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
