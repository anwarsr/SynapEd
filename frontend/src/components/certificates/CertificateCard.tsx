import type { Certificate } from "@/lib/certificates";

function formatCertDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(iso));
}

/**
 * Tampilan "dokumen" sertifikat — dipakai baik di halaman verifikasi publik
 * maupun halaman cetak peserta, supaya keduanya selalu menampilkan bentuk
 * yang sama persis.
 */
export default function CertificateCard({ certificate: c }: { certificate: Certificate }) {
  return (
    <div className="relative rounded-3xl border-2 border-rule-strong bg-paper-card px-8 py-12 sm:px-16 sm:py-16 text-center overflow-hidden">
      <div aria-hidden="true" className="absolute inset-3 rounded-2xl border border-rule pointer-events-none" />

      <p className="t-label text-ink-faint mb-8">Sertifikat Penyelesaian</p>

      <p className="text-sm text-ink-muted mb-2">Diberikan kepada</p>
      <p className="font-display text-3xl sm:text-4xl text-ink mb-8">{c.holderName}</p>

      <p className="text-sm text-ink-muted mb-2">atas keberhasilan menyelesaikan kursus</p>
      <p className="t-h3 mb-8">{c.courseTitle}</p>

      <p className="text-xs text-ink-muted mb-12">
        {c.lessonsTotal} pelajaran diselesaikan &middot; {formatCertDate(c.issuedAt)}
      </p>

      <div className="grid sm:grid-cols-2 gap-6 pt-8 border-t border-rule text-sm">
        <div>
          <p className="text-ink">{c.instructorName}</p>
          <p className="text-xs text-ink-muted mt-1">Instruktur</p>
        </div>
        <div>
          <p className="t-numeral text-ink tabular-nums">{c.id}</p>
          <p className="text-xs text-ink-muted mt-1">Nomor Sertifikat</p>
        </div>
      </div>
    </div>
  );
}
