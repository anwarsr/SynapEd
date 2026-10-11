"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinClass } from "@/lib/classActions";
import { INVITE_CODE_LENGTH, normalizeInviteCode } from "@/lib/inviteCode";
import { cn } from "@/lib/cn";

const DISPLAY_JUDUL = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
} as const;

/**
 * Panel kode undangan.
 *
 * Masukannya dinormalkan SAAT DIKETIK — huruf kecil dinaikkan, O menjadi 0, I
 * dan L menjadi 1. Orang menyalin kode dari pesan yang formatnya bermacam-macam,
 * dan menolak kode yang sebenarnya benar hanya karena bentuk ketikannya adalah
 * kegagalan yang tidak bisa ditebak penyebabnya oleh siapa pun.
 *
 * Penormalan yang sama diulang di server. Yang di sini hanya untuk yang
 * terlihat; penjaga sebenarnya ada di joinClass().
 */
export default function JoinClassForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await joinClass(code);
      if (!res.ok) return setError(res.error);

      setCode("");
      router.refresh();
      router.push(`/kelas/${res.classId}`);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="bg-paper-card p-6">
        <p className="t-label text-ink-muted mb-1.5">Gabung kelas</p>
        <p className="text-[20px] leading-snug text-ink mb-5" style={DISPLAY_JUDUL}>
          Punya kode dari pengajar?
        </p>

        <label htmlFor="joincode" className="sr-only">
          Kode undangan
        </label>

        <input
          id="joincode"
          value={code}
          onChange={(e) => setCode(normalizeInviteCode(e.target.value))}
          maxLength={INVITE_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="7KQ2M4XB"
          className={cn(
            "w-full bg-white/[0.06] px-4 py-3.5",
            "text-center font-sans tabular-nums text-xl tracking-[0.24em] text-ink",
            "transition-colors duration-200 placeholder:text-ink-faint",
            "focus:bg-white/10 focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] focus:outline-none",
          )}
        />

        <button
          type="submit"
          disabled={pending || code.length < INVITE_CODE_LENGTH}
          className={cn(
            "mt-4 w-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white",
            "transition-all duration-200 ease-out-soft hover:bg-blue-700",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {pending ? "Memeriksa…" : "Gabung kelas"}
        </button>

        <p className="mt-3 text-xs text-ink-muted">
          Kode berisi {INVITE_CODE_LENGTH} karakter, diberikan oleh pengajar kelasnya.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rust-700">
            {error}
          </p>
        )}
      </form>

      <div className="bg-white/5 p-5">
        <p className="text-sm font-medium text-ink">Belum punya kode?</p>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-muted">
          Kode undangan hanya dibagikan pengajar kepada pesertanya. Hubungi pengajar Anda,
          atau jelajahi katalog kursus sambil menunggu.
        </p>
      </div>
    </div>
  );
}
