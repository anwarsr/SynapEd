import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import CertificateCard from "@/components/certificates/CertificateCard";
import PrintCertificateButton from "@/components/certificates/PrintCertificateButton";
import { getCertificate } from "@/lib/certificates";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sertifikat Saya – SynapEd" };

export default async function CertificatePrintPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/certificates/${id}`);
  const certificate = await getCertificate(id);

  // notFound, bukan pesan "bukan milik Anda" — supaya URL sertifikat orang
  // lain tidak bisa dipakai untuk memastikan sertifikat itu ada.
  if (!certificate || (certificate.uid !== user.uid && user.role !== "admin")) notFound();

  return (
    <>
      <div className="print:hidden">
        <Navbar />
      </div>

      <main className="bg-paper min-h-screen pt-36 pb-24 print:pt-0 print:pb-0 print:bg-white">
        <div className="container-reading max-w-2xl">
          <div className="print:hidden flex flex-wrap items-center justify-between gap-4 mb-8">
            <Link href="/dashboard" className="text-sm text-blue-700 hover:underline underline-offset-4">
              ← Kembali ke Profil Saya
            </Link>
            <PrintCertificateButton />
          </div>

          <CertificateCard certificate={certificate} />

          <p className="print:hidden text-center text-xs text-ink-muted mt-6">
            Tautan verifikasi publik: <span className="t-numeral">/verify/{certificate.id}</span>
          </p>
        </div>
      </main>

      <div className="print:hidden">
        <Footer />
      </div>
    </>
  );
}
