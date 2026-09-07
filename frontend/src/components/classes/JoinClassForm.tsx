"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label, inputClass } from "@/components/educator/fields";
import { joinClass } from "@/lib/classActions";
import { INVITE_CODE_LENGTH, normalizeInviteCode } from "@/lib/inviteCode";
import { cn } from "@/lib/cn";

/**
 * Formulir kode undangan.
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
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-6">
      <Label htmlFor="joincode">Kode undangan</Label>

      <div className="flex flex-wrap gap-3">
        <input
          id="joincode"
          value={code}
          onChange={(e) => setCode(normalizeInviteCode(e.target.value))}
          maxLength={INVITE_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="Contoh: 7KQ2M4XB"
          className={cn(inputClass, "font-mono tracking-[0.2em] sm:w-64")}
        />

        <button
          type="submit"
          disabled={pending || code.length < INVITE_CODE_LENGTH}
          className={cn(
            "rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shrink-0",
            "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
            "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
          )}
        >
          {pending ? "Memeriksa…" : "Gabung"}
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Kode berisi {INVITE_CODE_LENGTH} karakter, diberikan oleh pengajar kelasnya.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
    </form>
  );
}
