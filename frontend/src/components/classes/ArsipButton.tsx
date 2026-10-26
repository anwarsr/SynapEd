"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPostArchived } from "@/lib/classActions";
import { cn } from "@/lib/cn";

/**
 * Tombol "Arsipkan" / "Pulihkan" sebuah postingan. Tanpa dialog konfirmasi:
 * tidak ada yang hilang, dan kebalikannya satu klik di zona Arsip.
 * Hanya dirender untuk pengelola kelas; penjaganya tetap di server.
 */
export default function ArsipButton({
  classId,
  postId,
  arsip,
  className,
}: {
  classId: string;
  postId: string;
  /** true = postingan sudah terarsip, tombol memulihkannya. */
  arsip: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function jalankan() {
    setError(null);
    startTransition(async () => {
      const res = await setPostArchived(classId, postId, !arsip);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={jalankan}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors duration-200 hover:text-blue-700 disabled:opacity-60",
          className,
        )}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875V7.5M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        {pending ? "Memproses…" : arsip ? "Pulihkan" : "Arsipkan"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rust-700">
          {error}
        </p>
      )}
    </>
  );
}
