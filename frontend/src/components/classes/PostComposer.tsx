"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";
import { createPost } from "@/lib/classActions";
import { MAX_POST_BODY } from "@/lib/classTypes";
import { cn } from "@/lib/cn";

/** Kotak tulis pengumuman. Hanya dirender untuk pemilik kelas. */
export default function PostComposer({
  classId,
  meName,
  mePhoto,
}: {
  classId: string;
  meName: string;
  mePhoto: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createPost(classId, body);
      if (!res.ok) return setError(res.error);

      setBody("");
      router.refresh();
    });
  }

  const sisa = MAX_POST_BODY - body.length;

  return (
    <form onSubmit={onSubmit} className="bg-paper-card p-6">
      <div className="flex items-start gap-3">
        <span className="shrink-0">
          <UserAvatar name={meName} photoURL={mePhoto} />
        </span>

        <div className="min-w-0 flex-1">
          <label htmlFor="postbody" className="sr-only">
            Tulis untuk kelas ini
          </label>

          <textarea
            id="postbody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_POST_BODY}
            rows={3}
            placeholder="Pengumuman, materi singkat, atau pengantar diskusi."
            className={cn(
              "w-full resize-y bg-white/[0.06] px-4 py-3 text-[15px] leading-[1.7] text-ink",
              "transition-colors duration-200 placeholder:text-ink-faint",
              "focus:bg-white/10 focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] focus:outline-none",
            )}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">
              {sisa < 500 ? `${sisa} karakter tersisa` : "Terlihat oleh seluruh anggota kelas"}
            </span>

            <button
              type="submit"
              disabled={pending || body.trim().length === 0}
              className={cn(
                "bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white",
                "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
                "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
              )}
            >
              {pending ? "Mengirim…" : "Kirim ke kelas"}
            </button>
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-rust-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
