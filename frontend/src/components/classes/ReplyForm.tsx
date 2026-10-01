"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import UserAvatar from "@/components/ui/UserAvatar";
import { createReply } from "@/lib/classActions";
import { MAX_REPLY_BODY } from "@/lib/classTypes";
import { cn } from "@/lib/cn";

/**
 * Kotak balasan, sengaja ringkas dan selalu terlihat.
 *
 * Tidak diciutkan di balik tombol "Balas": satu ketukan tambahan sebelum
 * mengetik cukup untuk membuat sebagian besar orang urung membalas, dan kelas
 * yang sunyi adalah kegagalan fitur ini.
 */
export default function ReplyForm({
  classId,
  postId,
  meName,
  mePhoto,
}: {
  classId: string;
  postId: string;
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
      const res = await createReply(classId, postId, body);
      if (!res.ok) return setError(res.error);

      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="shrink-0">
          <UserAvatar name={meName} photoURL={mePhoto} size="sm" />
        </span>

        <label htmlFor={`reply-${postId}`} className="sr-only">
          Tulis balasan
        </label>

        <input
          id={`reply-${postId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX_REPLY_BODY}
          placeholder="Tulis balasan…"
          className={cn(
            "min-w-0 flex-1 rounded-full border border-rule bg-paper px-[18px] py-2.5 text-sm text-ink",
            "transition-colors duration-200 placeholder:text-ink-faint",
            "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25",
          )}
        />

        <button
          type="submit"
          disabled={pending || body.trim().length === 0}
          className={cn(
            "shrink-0 rounded-full border border-rule px-5 py-2.5 text-sm font-medium text-ink-body",
            "transition-colors duration-200 hover:border-blue-500 hover:text-blue-700",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          {pending ? "Mengirim…" : "Balas"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-rust-700">
          {error}
        </p>
      )}
    </form>
  );
}
