"use client";
import { DOC_ACCEPT } from "@/lib/courseUpload";

/**
 * Elemen formulir dasar dipakai bersama oleh CourseForm (buat kursus baru)
 * dan CurriculumEditor/CourseMetaForm (sunting kursus) — supaya tampilan
 * dan perilaku input tetap satu, bukan dua yang perlahan berbeda.
 */

export const inputClass =
  "w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink transition-colors duration-200 placeholder:text-ink-faint focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25";

export function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block t-label text-ink-muted mb-2">
      {children}
    </label>
  );
}

export function FilePick({
  id,
  file,
  error,
  onPick,
}: {
  id: string;
  /** Hanya `.name` yang dibaca di sini — cukup untuk berkas yang sudah
   *  tersimpan (dari server) maupun File asli dari <input type=file>. */
  file: { name: string } | null;
  error: string | null;
  onPick: (f: File | null) => void;
}) {
  return (
    <div>
      <input
        id={id}
        type="file"
        accept={DOC_ACCEPT}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          className="cursor-pointer rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-200 ease-out-soft hover:border-blue-500 hover:text-blue-700"
        >
          {file ? "Ganti Berkas" : "Pilih Berkas"}
        </label>
        <span className="text-sm text-ink-muted truncate max-w-[18rem]">
          {file ? file.name : "PDF, maksimal 20 MB"}
        </span>
      </div>
      {error && <p className="mt-2 text-sm text-rust-700">{error}</p>}
    </div>
  );
}
