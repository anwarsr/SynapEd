"use client";
import { useState } from "react";
import { LAB_URL_PARAM } from "@/lib/lab/labUrl";
import { cn } from "@/lib/cn";

/**
 * Menyalin tautan yang memuat keadaan papan sekarang.
 *
 * URL hanya ditulis saat tombol ini ditekan, BUKAN setiap operasi. Menulis
 * terus-menerus membuat tombol Back peramban dan tombol "batalkan" di papan
 * menjadi dua riwayat yang bersaing — pengguna menekan Back dan papannya
 * melompat ke tempat yang tidak ia duga.
 *
 * `kode` dipanggil saat tombol ditekan, bukan saat render: mengodekan papan
 * setiap render hanya membuang waktu untuk tautan yang jarang diminta.
 */
export default function ShareLabButton({ kode: buatKode }: { kode: () => string | null }) {
  const [pesan, setPesan] = useState<{ teks: string; ok: boolean } | null>(null);

  async function bagikan() {
    const kode = buatKode();
    if (kode === null) {
      setPesan({ teks: "Papan terlalu besar untuk dibagikan - kurangi isi atau catatannya.", ok: false });
      return;
    }

    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set(LAB_URL_PARAM, kode);
    const tautan = url.toString();

    try {
      await navigator.clipboard.writeText(tautan);
      setPesan({ teks: "Tautan disalin", ok: true });
      window.setTimeout(() => setPesan(null), 2400);
    } catch {
      // Clipboard ditolak (konteks tidak aman, izin dicabut): tampilkan
      // tautannya supaya tetap bisa disalin manual.
      setPesan({ teks: tautan, ok: false });
    }
  }

  return (
    <span className="relative flex items-center">
      <button
        type="button"
        onClick={bagikan}
        className={cn(
          "inline-flex items-center gap-1.5 bg-blue-500/15 px-3 py-2 text-sm font-medium text-blue-200",
          "transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-soft",
        )}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
          />
        </svg>
        Bagikan
      </button>

      {pesan && (
        <span
          role="status"
          className={cn(
            "lab-fade-up absolute right-0 top-full z-20 mt-2 w-max max-w-[20rem] break-all rounded-lg px-3 py-1.5 text-xs shadow-lift",
            pesan.ok ? "bg-ink text-paper" : "bg-paper-card text-ink-body",
          )}
        >
          {pesan.teks}
        </span>
      )}
    </span>
  );
}
