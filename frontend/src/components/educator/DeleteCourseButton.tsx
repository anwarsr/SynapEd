"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteCourse } from "@/lib/courseActions";

export default function DeleteCourseButton({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setAsking(false);
    startTransition(async () => {
      const result = await deleteCourse(slug);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <>
      <button
        onClick={() => setAsking(true)}
        disabled={pending}
        className="text-sm text-rust-700 hover:underline underline-offset-4 disabled:opacity-60"
      >
        {pending ? "Menghapus…" : "Hapus"}
      </button>

      <ConfirmDialog
        open={asking}
        title="Hapus kursus ini?"
        description={`"${title}" akan hilang dari katalog beserta materinya.`}
        note="Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />

      {error && <p className="mt-2 text-sm text-rust-700">{error}</p>}
    </>
  );
}
