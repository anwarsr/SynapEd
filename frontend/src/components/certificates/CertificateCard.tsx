import type { Certificate } from "@/lib/certificates";

function formatCertDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" }).format(new Date(iso));
}

/** Hiasan sudut: dua garis siku yang saling menumpuk, diputar per sudut. */
function Sudut({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={`pointer-events-none absolute h-9 w-9 text-amber-700 sm:h-12 sm:w-12 ${className}`}
      fill="none"
      stroke="currentColor"
    >
      <path d="M2 46V2h44" strokeWidth="2" />
      <path d="M10 46V10h36" strokeWidth="0.75" />
      <rect x="2" y="2" width="6" height="6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Pemisah: garis tipis dengan belah ketupat di tengah. */
function Pemisah() {
  return (
    <div aria-hidden="true" className="mx-auto flex w-40 items-center gap-3 sm:w-56">
      <span className="h-px flex-1 bg-amber-700/50" />
      <span className="h-1.5 w-1.5 rotate-45 bg-amber-700" />
      <span className="h-px flex-1 bg-amber-700/50" />
    </div>
  );
}

/** Meterai bulat bertuliskan melingkar, dengan tanda centang di tengah. */
function Meterai() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24 text-blue-700 sm:h-28 sm:w-28" role="img" aria-label="Meterai SynapEd">
      <defs>
        <path id="meterai-lingkar" d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" />
      </defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 3" />
      <circle cx="60" cy="60" r="31" fill="none" stroke="currentColor" strokeWidth="1" />
      <text fontSize="8.6" fill="currentColor" fontWeight="700" fontFamily="var(--font-sans)">
        <textPath href="#meterai-lingkar" textLength="262" lengthAdjust="spacing">
          SYNAPED ✦ SERTIFIKAT RESMI ✦
        </textPath>
      </text>
      <path
        d="M47 61l9 9 17-19"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Tampilan "dokumen" sertifikat — dipakai baik di halaman verifikasi publik
 * maupun halaman cetak peserta, supaya keduanya selalu menampilkan bentuk
 * yang sama persis.
 *
 * Selalu terang (`theme-day`), apa pun tema situsnya: sertifikat adalah
 * dokumen cetak, dan logo berwarna hitam-biru hanya terbaca di atas latar
 * terang. Karena itu pula tidak ada `text-white` di sini (di tema terang
 * situs, token putih dibalik jadi tinta).
 */
export default function CertificateCard({ certificate: c }: { certificate: Certificate }) {
  return (
    <div
      className="theme-day relative overflow-hidden bg-ivory px-6 py-10 text-center text-ink sm:px-16 sm:py-14"
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
        backgroundImage:
          "radial-gradient(ellipse 70% 45% at 50% 0%, color-mix(in srgb, var(--color-blue-100) 55%, transparent), transparent)",
      }}
    >
      {/* Bingkai ganda: garis tebal biru di luar, garis rambut hangat di dalam. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-2 border-2 border-blue-700 sm:inset-3" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-4 border border-amber-700/40 sm:inset-6" />

      <Sudut className="left-4 top-4 sm:left-6 sm:top-6" />
      <Sudut className="right-4 top-4 rotate-90 sm:right-6 sm:top-6" />
      <Sudut className="bottom-4 right-4 rotate-180 sm:bottom-6 sm:right-6" />
      <Sudut className="bottom-4 left-4 -rotate-90 sm:bottom-6 sm:left-6" />

      <div className="relative">
        {/* Berkas logo berkanvas persegi dengan ruang kosong lebar di atas-bawah
            kata; margin negatif memangkasnya tanpa menyentuh berkas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/logotext.png"
          alt="SynapEd"
          width={667}
          height={667}
          className="mx-auto h-auto w-44 sm:w-56"
          style={{ marginBlock: "-4.2rem" }}
        />

        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.42em] text-amber-700 sm:mt-10">
          Sertifikat
        </p>
        <p
          className="mt-1 text-xl font-light uppercase tracking-[0.3em] text-ink sm:text-2xl"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Penyelesaian
        </p>

        <div className="my-7 sm:my-9">
          <Pemisah />
        </div>

        <p className="text-[11px] uppercase tracking-[0.3em] text-ink-muted">Diberikan kepada</p>
        <p
          className="mx-auto mt-3 max-w-full wrap-break-word text-[clamp(1.9rem,6vw,3.2rem)] font-medium leading-[1.1] tracking-[-0.02em] text-blue-700"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {c.holderName}
        </p>
        <span aria-hidden="true" className="mx-auto mt-4 block h-px w-3/4 max-w-md bg-rule-strong" />

        <p className="mt-8 text-[11px] uppercase tracking-[0.3em] text-ink-muted">atas keberhasilan menyelesaikan kursus</p>
        <p
          className="mx-auto mt-2 max-w-xl text-xl font-semibold leading-snug tracking-[-0.015em] text-ink sm:text-2xl"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {c.courseTitle}
        </p>

        <p className="mt-5 text-xs uppercase tracking-[0.18em] text-ink-muted">
          {c.lessonsTotal} pelajaran diselesaikan &middot; {formatCertDate(c.issuedAt)}
        </p>

        <div className="mx-auto mt-10 grid max-w-xl items-center gap-8 sm:mt-12 sm:grid-cols-[1fr_auto_1fr]">
          <div className="sm:text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-ink-muted">Instruktur</p>
            <p className="mt-2 text-base font-semibold text-ink">{c.instructorName}</p>
          </div>

          <div className="mx-auto">
            <Meterai />
          </div>

          <div className="sm:text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-ink-muted">Nomor Sertifikat</p>
            <p className="t-numeral mt-2 break-all text-base tabular-nums text-ink">{c.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
