"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label, inputClass } from "./fields";
import ThumbnailPicker from "./ThumbnailPicker";
import DurationField from "./DurationField";
import SectionList, {
  draftFromCourse,
  toSectionInput,
  validateDraft,
  type DraftSection,
} from "./curriculumDraft";
import { requestCourseEdit } from "@/lib/courseRequestActions";
import { updateCourseMeta } from "@/lib/curriculumActions";
import { saveCurriculum } from "@/lib/curriculumActions";
import type { CourseDetail } from "@/lib/courses";
import { cn } from "@/lib/cn";

interface Option {
  readonly value: string;
  readonly label?: string;
}

/**
 * Satu panel untuk seluruh suntingan kursus: info dan kurikulum sekaligus.
 *
 * Dulu keduanya form terpisah dengan tombol simpan masing-masing. Sejak
 * perubahan harus melewati persetujuan, pemisahan itu jadi merugikan: admin
 * akan menerima dua pengajuan terpisah untuk satu kursus yang sama, dengan
 * dua alasan, dan perbandingan sebelum-sesudah yang terpotong dua.
 *
 * Dua mode penyimpanan:
 *   - educator -> mengajukan perubahan, menunggu persetujuan
 *   - admin    -> langsung berlaku, karena dialah yang menyetujui
 */
export default function CourseChangePanel({
  slug,
  course,
  levels,
  categories,
  mode,
  locked,
}: {
  slug: string;
  course: CourseDetail;
  levels: readonly Option[];
  categories: readonly Option[];
  mode: "request" | "direct";
  /** Ada pengajuan yang menunggu — form dikunci agar tidak bertumpuk. */
  locked: boolean;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(course.title);
  const [shortDesc, setShortDesc] = useState(course.shortDesc);
  const [longDesc, setLongDesc] = useState(course.longDesc);
  const [level, setLevel] = useState(course.level);
  const [category, setCategory] = useState(course.category);
  const [duration, setDuration] = useState(course.duration);
  const [price, setPrice] = useState(String(course.price));

  // `undefined` berarti gambarnya tidak disentuh — nilainya dibiarkan apa
  // adanya di server. Penting untuk kursus lama yang gambarnya berupa URL.
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);

  const [whatYouLearn, setWhatYouLearn] = useState((course.whatYouLearn ?? []).join("\n"));
  const [requirements, setRequirements] = useState((course.requirements ?? []).join("\n"));

  const [sections, setSections] = useState<DraftSection[]>(() => draftFromCourse(course));

  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);

    const problem = validateDraft(sections);
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);

    const meta = {
      title,
      shortDesc,
      longDesc,
      level,
      category,
      duration,
      price: Number(price) || 0,
      thumbnail,
      whatYouLearn: lines(whatYouLearn),
      requirements: lines(requirements),
    };

    if (mode === "request") {
      const res = await requestCourseEdit(slug, { ...meta, sections: toSectionInput(sections) }, reason);
      setPending(false);
      if (!res.ok) return setError(res.error);
      setDone(res.message);
      setReason("");
      router.refresh();
      return;
    }

    // Jalur admin: dua penulisan berurutan. Kalau yang pertama gagal, yang
    // kedua tidak dijalankan — lebih baik separuh tidak tersimpan dan
    // dikatakan, daripada keduanya tersimpan setengah-setengah diam-diam.
    const metaRes = await updateCourseMeta(slug, meta);
    if (!metaRes.ok) {
      setPending(false);
      return setError(metaRes.error);
    }
    const curRes = await saveCurriculum(slug, toSectionInput(sections));
    setPending(false);
    if (!curRes.ok) return setError(curRes.error);

    setDone("Perubahan tersimpan.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}
      {done && (
        <div role="status" className="rounded-lg border border-blue-500/25 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {done}
        </div>
      )}

      <fieldset disabled={locked || pending} className="space-y-6 disabled:opacity-60">
        <section className="bg-paper-card border border-rule rounded-2xl p-7">
          <h2 className="t-h3 mb-1.5">Tentang Kursus</h2>
          <p className="t-body text-sm mb-6">Yang dilihat calon peserta di katalog.</p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Judul kursus</Label>
              <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
            </div>

            <div>
              <Label htmlFor="shortDesc">Deskripsi singkat</Label>
              <input id="shortDesc" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} className={inputClass} required />
            </div>

            <div>
              <Label htmlFor="longDesc">Deskripsi lengkap</Label>
              <textarea id="longDesc" value={longDesc} onChange={(e) => setLongDesc(e.target.value)} rows={4} className={cn(inputClass, "resize-y")} />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="level">Tingkat</Label>
                <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass}>
                  {levels.map((l) => (
                    <option key={l.value} value={l.value}>{l.label ?? l.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="category">Kategori</Label>
                <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label ?? c.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="duration">Perkiraan durasi</Label>
                <DurationField id="duration" scope="course" value={duration} onChange={setDuration} />
              </div>
            </div>

            <div className="max-w-xs">
              <Label htmlFor="price">Harga (Rp)</Label>
              <input id="price" type="number" min={0} step={1000} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
              <p className="mt-2 text-xs text-ink-muted">0 berarti gratis.</p>
            </div>

            <ThumbnailPicker initial={course.thumbnail} prefix={slug} onChange={setThumbnail} />

            <div>
              <Label htmlFor="whatYouLearn">Yang akan dipelajari</Label>
              <textarea id="whatYouLearn" value={whatYouLearn} onChange={(e) => setWhatYouLearn(e.target.value)} rows={4} placeholder={"Satu baris satu poin."} className={cn(inputClass, "resize-y")} />
            </div>

            <div>
              <Label htmlFor="requirements">Persyaratan</Label>
              <textarea id="requirements" value={requirements} onChange={(e) => setRequirements(e.target.value)} rows={3} placeholder={"Satu baris satu poin."} className={cn(inputClass, "resize-y")} />
            </div>
          </div>
        </section>

        <div>
          <h2 className="t-h3 mb-1.5">Kurikulum</h2>
          <p className="t-body text-sm text-ink-muted mb-6">Bagian dan pelajaran di dalam kursus ini.</p>
          <SectionList sections={sections} setSections={setSections} uploadPrefix={slug} courseSlug={slug} />
        </div>

        {mode === "request" && (
          <section className="bg-paper-card border border-rule rounded-2xl p-7">
            <Label htmlFor="reason">Alasan perubahan</Label>
            <p className="text-xs text-ink-muted mb-3">
              Dibaca admin saat meninjau. Jelaskan apa yang Anda ubah dan mengapa.
            </p>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Contoh: Memperbarui modul 2 karena ada tautan yang sudah tidak berlaku."
              className={cn(inputClass, "resize-y")}
              required
              minLength={10}
            />
          </section>
        )}
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending || locked}
          className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending
            ? mode === "request" ? "Mengirim…" : "Menyimpan…"
            : mode === "request" ? "Ajukan Perubahan" : "Simpan Perubahan"}
        </button>
      </div>
    </form>
  );
}
