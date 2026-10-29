"use client";
import { useRef, useState } from "react";
import {
  acceptUntuk,
  ekstensiOf,
  galatBerkas,
  type FormatTugas,
} from "@/lib/classAssignmentRules";
import { formatBytes } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";

/**
 * Pemilih beberapa berkas sekaligus, dengan daftar yang bisa dibuang satu-satu.
 *
 * Berkas hanya DIPEGANG di memori browser; pengunggahan terjadi saat
 * formulirnya dikirim. Berkas yang ditolak (jenis/ukuran) tidak masuk daftar
 * dan alasannya ditulis — bukan diam-diam hilang.
 *
 * `formats` null = lampiran pengajar (semua jenis yang dikenal).
 */
export default function PemilihBerkas({
  files,
  onChange,
  formats,
  maks,
  disabled,
  label = "Lampirkan berkas",
}: {
  files: readonly File[];
  onChange: (files: File[]) => void;
  formats: readonly FormatTugas[] | null;
  maks: number;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [galat, setGalat] = useState<string | null>(null);

  function tambah(baru: FileList | null) {
    if (!baru || baru.length === 0) return;
    const diterima: File[] = [];
    const ditolak: string[] = [];

    for (const f of Array.from(baru)) {
      const salah = galatBerkas(f, formats);
      if (salah) ditolak.push(salah);
      else if (!files.some((x) => x.name === f.name && x.size === f.size)) diterima.push(f);
    }

    const gabung = [...files, ...diterima];
    if (gabung.length > maks) ditolak.push(`Maksimal ${maks} berkas.`);

    setGalat(ditolak.length > 0 ? ditolak.join(" ") : null);
    onChange(gabung.slice(0, maks));
  }

  return (
    <div>
      {files.length > 0 && (
        <ul className="mb-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex min-w-0 items-center gap-3 bg-white/[0.06] px-3 py-2"
            >
              <span className="w-11 shrink-0 text-center text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                {ekstensiOf(f.name).replace(".", "")}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{f.name}</span>
              <span className="shrink-0 text-xs text-ink-muted">{formatBytes(f.size)}</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Buang ${f.name}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-paper-alt hover:text-rust-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptUntuk(formats)}
        className="hidden"
        onChange={(e) => {
          tambah(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={disabled || files.length >= maks}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-body",
          "transition-colors duration-200 hover:text-blue-700",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
        {label}
      </button>
      <span className="ml-3 text-xs text-ink-muted">
        {files.length}/{maks} · maks 20 MB per berkas
      </span>

      {galat && (
        <p role="alert" className="mt-2 text-sm text-rust-700">
          {galat}
        </p>
      )}
    </div>
  );
}
