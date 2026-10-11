"use client";
import { DOC_ACCEPT } from "@/lib/courseUpload";

/**
 * Elemen formulir dasar dipakai bersama oleh CourseForm (buat kursus baru)
 * dan CurriculumEditor/CourseMetaForm (sunting kursus) — supaya tampilan
 * dan perilaku input tetap satu, bukan dua yang perlahan berbeda.
 */

export const inputClass =
  "w-full bg-white/[0.06] px-4 py-3 text-sm text-ink shadow-[inset_0_-1px_0_var(--color-rule)] transition-[background-color,box-shadow] duration-300 placeholder:text-ink-faint hover:bg-white/[0.09] focus:bg-white/[0.09] focus:shadow-[inset_0_-2px_0_var(--color-blue-400)] focus:outline-none";

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
          className="cursor-pointer bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-white/15"
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
