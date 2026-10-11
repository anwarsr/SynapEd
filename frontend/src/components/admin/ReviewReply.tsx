"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyToReview } from "@/lib/reviewActions";
import { cn } from "@/lib/cn";

const MAX = 600;

/**
 * Balasan admin pada satu ulasan. Balasan yang ada tampil sebagai kutipan
 * bergaris biru dengan tautan "Ubah"/"Hapus"; belum ada = tombol "Balas".
 * Balasan tampil di kartu komentar beranda dan di halaman kursus.
 */
export default function ReviewReply({ id, initial, by }: { id: string; initial: string | null; by: string | null }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [teks, setTeks] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function simpan(isi: string) {
    setError(null);
    startTransition(async () => {
      const res = await replyToReview(id, isi);
      if (!res.ok) return setError(res.error);
      if (!isi.trim()) setTeks("");
      setEdit(false);
      router.refresh();
    });
  }

  if (edit) {
    return (
      <div className="mt-4">
        <label htmlFor={`balas-${id}`} className="sr-only">
          Balasan untuk ulasan ini
        </label>
        <textarea
          id={`balas-${id}`}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          maxLength={MAX}
          rows={3}
          autoFocus
          placeholder="Tulis balasan. Akan tampil di kartu komentar beranda dan halaman kursus."
          className="w-full resize-y bg-white/[0.06] px-4 py-3 text-sm text-white shadow-[inset_0_-1px_0_var(--color-rule)] transition-[background-color,box-shadow] duration-300 placeholder:text-white/35 focus:bg-white/[0.09] focus:shadow-[inset_0_-2px_0_var(--color-blue-400)] focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => simpan(teks)}
            disabled={pending || !teks.trim()}
            className="bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Menyimpan…" : "Kirim balasan"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEdit(false);
              setTeks(initial ?? "");
              setError(null);
            }}
            className="bg-white/10 px-5 py-2 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-white/15"
          >
            Batal
          </button>
          <span className="ml-auto text-xs tabular-nums text-ink-muted">
            {teks.length}/{MAX}
          </span>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-rust-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("mt-4", initial && "bg-white/[0.04] px-4 py-3 shadow-[inset_3px_0_0_var(--color-blue-500)]")}>
      {initial ? (
        <>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-blue-300">Balasan {by ?? "admin"}</p>
          <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-[1.7] text-ink-body">{initial}</p>
          <div className="mt-2 flex gap-4 text-[12.5px] font-semibold">
            <button type="button" onClick={() => setEdit(true)} className="text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline">
              Ubah
            </button>
            <button
              type="button"
              onClick={() => simpan("")}
              disabled={pending}
              className="text-error-text underline-offset-4 hover:underline disabled:opacity-50"
            >
              {pending ? "Menghapus…" : "Hapus"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setEdit(true)}
          className="bg-white/10 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors duration-200 hover:bg-white/15"
        >
          Balas
        </button>
      )}
      {error && !edit && (
        <p role="alert" className="mt-2 text-sm text-rust-700">
          {error}
        </p>
      )}
    </div>
  );
}
