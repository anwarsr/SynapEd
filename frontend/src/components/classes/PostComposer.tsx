"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/lib/classActions";
import { MAX_POST_BODY } from "@/lib/classTypes";
import { cn } from "@/lib/cn";

/** Kotak tulis pengumuman. Hanya dirender untuk pemilik kelas. */
export default function PostComposer({ classId }: { classId: string }) {
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
    <form onSubmit={onSubmit} className="bg-paper-card border border-rule rounded-2xl p-6">
      <label htmlFor="postbody" className="block t-label text-ink-muted mb-2">
        Tulis untuk kelas ini
      </label>

      <textarea
        id="postbody"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX_POST_BODY}
        rows={4}
        placeholder="Pengumuman, materi singkat, atau pengantar diskusi."
        className={cn(
          "w-full rounded-lg border border-rule bg-paper px-4 py-2.5 text-sm text-ink resize-y",
          "transition-colors duration-200 placeholder:text-ink-faint",
          "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
        )}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className={cn(
            "rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white",
            "transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5",
            "disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed",
          )}
        >
          {pending ? "Mengirim…" : "Kirim"}
        </button>

        {sisa < 500 && (
          <span className="text-xs text-ink-muted">{sisa} karakter tersisa</span>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rust-700">
          {error}
        </p>
      )}
    </form>
  );
}
