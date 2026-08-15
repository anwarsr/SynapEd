"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCurriculum } from "@/lib/curriculumActions";
import type { CourseDetail } from "@/lib/courses";
import SectionList, {
  draftFromCourse,
  toSectionInput,
  validateDraft,
  type DraftSection,
} from "./curriculumDraft";

/**
 * Editor kurikulum penuh — ganti seluruhnya, bukan patch per pelajaran.
 *
 * Penyusunnya sama persis dengan yang dipakai form buat kursus baru
 * (SectionList), jadi jumlah, jenis, dan urutan pelajaran berperilaku
 * identik di kedua tempat.
 *
 * Slug pelajaran yang sudah ada dipertahankan apa adanya supaya mengubah
 * judul tidak mengyatimkan completedLessons peserta.
 */
export default function CurriculumEditor({ slug, course }: { slug: string; course: CourseDetail }) {
  const router = useRouter();
  const [sections, setSections] = useState<DraftSection[]>(() => draftFromCourse(course));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const problem = validateDraft(sections);
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);
    const result = await saveCurriculum(slug, toSectionInput(sections));
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700"
        >
          {error}
        </div>
      )}

      <SectionList
        sections={sections}
        setSections={setSections}
        uploadPrefix={slug}
        courseSlug={slug}
      />

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Menyimpan…" : "Simpan Kurikulum"}
        </button>
        {saved && <span className="text-sm text-blue-700">Tersimpan.</span>}
      </div>
    </form>
  );
}
