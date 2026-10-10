"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCourse } from "@/lib/courseActions";
import { saveQuiz } from "@/lib/quizActions";
import { Label, inputClass } from "./fields";
import ThumbnailPicker from "./ThumbnailPicker";
import DurationField from "./DurationField";
import ContributorEditor, { type EditorPerson } from "./ContributorEditor";
import SectionList, {
  newKey,
  firstSection,
  toSectionInput,
  validateDraft,
  type DraftSection,
} from "./curriculumDraft";
import { cn } from "@/lib/cn";

interface Option {
  readonly value: string;
  readonly label?: string;
}

/** Kepala bab: nomor tipis-besar di kiri, judul & keterangan di sampingnya. */
function BabHead({ no, judul, sub }: { no: string; judul: string; sub: string }) {
  return (
    <header className="mb-7 flex items-end gap-5">
      <span
        aria-hidden="true"
        className="select-none text-[4.5rem] font-extralight leading-[0.8] tracking-[-0.06em] tabular-nums text-white/20"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {no}
      </span>
      <div className="pb-1">
        <h2 className="text-[1.6rem] font-bold leading-tight tracking-[-0.03em] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          {judul}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{sub}</p>
      </div>
    </header>
  );
}

export default function CourseForm({
  levels,
  categories,
  owner,
  feePercent,
}: {
  levels: readonly Option[];
  categories: readonly Option[];
  /** Pembuat kursus — otomatis pemilik dan kontributor pertama. */
  owner: EditorPerson;
  feePercent: number;
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [level, setLevel] = useState(levels[0].value);
  const [category, setCategory] = useState(categories[0]?.value ?? "");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("0");
  const [passingGrade, setPassingGrade] = useState("70");
  const [whatYouLearn, setWhatYouLearn] = useState("");
  const [requirements, setRequirements] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [contributors, setContributors] = useState<{ uid: string; share: number }[]>([]);

  const [sections, setSections] = useState<DraftSection[]>(() => firstSection("Materi Kursus"));

  // Berkas diunggah SEBELUM kursusnya ada, jadi belum ada slug untuk
  // mengelompokkannya. Satu id draft dipakai seumur pengisian form ini.
  const [draftId] = useState(newKey);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const problem = validateDraft(sections);
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);
    const result = await createCourse({
      title,
      shortDesc,
      longDesc,
      level,
      category,
      duration,
      price: Number(price) || 0,
      passingGrade: Number(passingGrade),
      whatYouLearn: lines(whatYouLearn),
      requirements: lines(requirements),
      thumbnail,
      sections: toSectionInput(sections),
      contributors,
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // Draft soal kuis yang tadi diisi di form ini ikut disimpan sekarang —
    // pelajarannya baru punya slug permanen setelah createCourse berhasil.
    // Paralel (bukan berurutan): setiap saveQuiz menulis dokumen independen
    // (courses/{slug}/quizzes/{lessonSlug}), tidak ada urutan yang perlu
    // dijaga di antaranya. Kegagalan salah satu SENGAJA tidak digagalkan
    // sebagai error pembuatan kursus — kursusnya sendiri sudah berhasil
    // dibuat; "Kelola Soal Kuis" di halaman sunting tetap jadi jalur
    // pemulihan manual kalau ada yang gagal tersimpan di sini.
    const quizSaves = sections.flatMap((s, si) =>
      s.lessons.flatMap((l, li) => {
        const draft = l.quizDraft;
        if (l.type !== "quiz" || !draft || draft.questions.length === 0) return [];
        const lessonSlug = result.lessonSlugs?.[si]?.[li];
        if (!lessonSlug) return [];
        return [
          saveQuiz(result.slug, lessonSlug, {
            passingScore: draft.passingScore,
            maxAttempts: draft.maxAttempts,
            questions: draft.questions,
          }),
        ];
      }),
    );
    if (quizSaves.length > 0) await Promise.allSettled(quizSaves);

    // Diantar ke halaman sunting, bukan ke halaman kursusnya: di sanalah soal
    // kuis yang belum sempat diisi bisa ditambahkan belakangan.
    router.replace(`/educator/courses/${result.slug}/edit`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-16">
      {error && (
        <div
          role="alert"
          className="bg-rust-100 px-4 py-3 text-sm text-rust-700"
        >
          {error}
        </div>
      )}

      {/* ── Keterangan kursus ───────────────────────────────── */}
      <section id="tentang" className="scroll-mt-32">
        <BabHead no="01" judul="Tentang kursus" sub="Yang dilihat calon peserta di katalog." />

        <div className="space-y-5 bg-paper-card p-7 sm:p-9">
          <div>
            <Label htmlFor="title">Judul kursus</Label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dasar Pemrosesan Sinyal EEG"
              className={inputClass}
              required
            />
          </div>

          <div>
            <Label htmlFor="shortDesc">Deskripsi singkat</Label>
            <input
              id="shortDesc"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Satu kalimat tentang isi kursus ini."
              className={inputClass}
              required
            />
          </div>

          <div>
            <Label htmlFor="longDesc">Deskripsi lengkap</Label>
            <textarea
              id="longDesc"
              value={longDesc}
              onChange={(e) => setLongDesc(e.target.value)}
              rows={4}
              placeholder="Opsional. Dikosongkan berarti memakai deskripsi singkat."
              className={cn(inputClass, "resize-y")}
            />
          </div>

          <div>
            <Label htmlFor="whatYouLearn">Yang akan dipelajari</Label>
            <textarea
              id="whatYouLearn"
              value={whatYouLearn}
              onChange={(e) => setWhatYouLearn(e.target.value)}
              rows={4}
              placeholder="Satu baris satu poin."
              className={cn(inputClass, "resize-y")}
            />
            <p className="mt-2 text-xs text-ink-muted">
              Tampil sebagai daftar di halaman kursus. Dikosongkan berarti bagian itu
              tidak ditampilkan sama sekali.
            </p>
          </div>

          <div>
            <Label htmlFor="requirements">Persyaratan</Label>
            <textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              placeholder="Satu baris satu poin."
              className={cn(inputClass, "resize-y")}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="level">Tingkat</Label>
              <select
                id="level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={inputClass}
              >
                {levels.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label ?? l.value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="category">Kategori</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label ?? c.value}
                  </option>
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
            <input
              id="price"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={inputClass}
            />
            <p className="mt-2 text-xs text-ink-muted">0 berarti gratis.</p>
          </div>

            <div className="max-w-xs">
              <Label htmlFor="passingGrade">Nilai minimum kelulusan</Label>
              <input
                id="passingGrade"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={passingGrade}
                onChange={(e) => setPassingGrade(e.target.value)}
                className={inputClass}
              />
              <p className="mt-2 text-xs text-ink-muted">
                Sertifikat baru terbit setelah seluruh penugasan dan kuis peserta dinilai
                dan mencapai angka ini.
              </p>
            </div>

          <ThumbnailPicker prefix={draftId} onChange={(v) => setThumbnail(v ?? null)} />
        </div>
      </section>

      <section id="kontributor" className="scroll-mt-32">
        <BabHead no="02" judul="Kontributor" sub="Siapa saja yang berbagi hasil penjualan kursus ini." />
        <ContributorEditor
          owner={owner}
          ownerIsViewer
          initial={[]}
          feePercent={feePercent}
          price={Number(price) || 0}
          onChange={setContributors}
          tanpaJudul
        />
      </section>

      {/* ── Kurikulum ───────────────────────────────────────── */}
      <section id="isi" className="scroll-mt-32">
        <BabHead
          no="03"
          judul="Isi kursus"
          sub="Tambahkan sebanyak yang Anda perlukan, dalam urutan mana pun. Tanda panah memindahkan posisinya."
        />

        <SectionList sections={sections} setSections={setSections} uploadPrefix={draftId} />
      </section>

      <section id="terbit" className="scroll-mt-32">
        <BabHead no="04" judul="Terbitkan" sub="Setelah disimpan, Anda diantar ke halaman sunting." />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5 bg-paper-card px-7 py-8 sm:px-9">
          <button
            type="submit"
            disabled={pending}
            className="bg-blue-600 px-9 py-4 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Menerbitkan…" : "Terbitkan kursus"}
          </button>
          <p className="max-w-[46ch] text-xs leading-[1.7] text-ink-muted">
            Soal kuis yang Anda isi di atas ikut tersimpan otomatis. Belum sempat diisi? Bisa
            ditambahkan belakangan dari halaman sunting.
          </p>
        </div>
      </section>
    </form>
  );
}
