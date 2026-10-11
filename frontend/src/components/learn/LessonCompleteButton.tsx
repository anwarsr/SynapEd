"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markLessonComplete } from "@/lib/enrollmentActions";
import { cn } from "@/lib/cn";

/**
 * Tombol tanda selesai pada satu pelajaran.
 *
 * arrayUnion di server bersifat idempoten, jadi tombol ini aman diklik
 * berkali-kali — tapi begitu tercatat selesai, tombolnya diganti lencana
 * supaya tidak menyiratkan ada aksi lanjutan yang perlu diambil.
 */
export default function LessonCompleteButton({
  slug,
  lessonSlug,
  done,
}: {
  slug: string;
  lessonSlug: string;
  done: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <span className="inline-flex items-center gap-2 bg-blue-500/15 px-5 py-2.5 text-sm font-medium text-blue-700">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Sudah selesai
      </span>
    );
  }

  function submit() {
    startTransition(async () => {
      const res = await markLessonComplete(slug, lessonSlug);
      if (!res.ok) return;
      // Pelajaran terakhir baru saja menerbitkan sertifikat — arahkan ke
      // halaman perayaan alih-alih sekadar menyegarkan halaman ini.
      if (res.certificateId) {
        router.push(`/courses/${slug}/complete`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={submit}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-2 bg-blue-600 px-5 py-2.5 text-sm font-medium text-white",
        "transition-colors duration-200 ease-out-soft hover:bg-blue-700",
        "disabled:opacity-60 disabled:cursor-not-allowed",
      )}
    >
      {pending ? "Menyimpan…" : "Tandai Selesai"}
    </button>
  );
}
