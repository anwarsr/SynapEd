"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { firebaseAuth } from "@/lib/firebase/client";
import { createCourse } from "@/lib/courseActions";
import { uploadCourseDoc, validateDoc } from "@/lib/courseUpload";
import { toEmbedUrl } from "@/lib/videoEmbed";
import { FilePick, Label, inputClass } from "./fields";
import { cn } from "@/lib/cn";

interface Option {
  readonly value: string;
  readonly label?: string;
}

export default function CourseForm({
  levels,
  categories,
  icons,
}: {
  levels: readonly Option[];
  categories: readonly Option[];
  icons: readonly string[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [level, setLevel] = useState(levels[0].value);
  const [category, setCategory] = useState(categories[0].value);
  const [icon, setIcon] = useState(icons[0]);
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("0");
  const [videoUrl, setVideoUrl] = useState("");

  const [modul, setModul] = useState<File | null>(null);
  const [tugas, setTugas] = useState<File | null>(null);
  const [modulError, setModulError] = useState<string | null>(null);
  const [tugasError, setTugasError] = useState<string | null>(null);

  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoOk = videoUrl.trim() === "" || toEmbedUrl(videoUrl) !== null;
  const pending = step !== null;

  function pick(which: "modul" | "tugas") {
    return (file: File | null) => {
      const setFile = which === "modul" ? setModul : setTugas;
      const setError_ = which === "modul" ? setModulError : setTugasError;

      if (!file) {
        setFile(null);
        setError_(null);
        return;
      }

      const invalid = validateDoc(file);
      setError_(invalid);
      setFile(invalid ? null : file);
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!modul || !tugas) {
      setError("Modul materi dan penugasan akhir wajib diunggah.");
      return;
    }
    if (!toEmbedUrl(videoUrl)) {
      setError("Tautan video tidak dikenali. Gunakan tautan YouTube.");
      return;
    }

    const uid = firebaseAuth().currentUser?.uid;
    if (!uid) {
      setError("Sesi berakhir. Silakan masuk kembali.");
      return;
    }

    // Satu draftId mengelompokkan kedua berkas, supaya berkas satu kursus
    // tidak tercampur dengan kursus lain di dalam folder yang sama.
    const draftId = crypto.randomUUID().slice(0, 8);

    try {
      setStep("Mengunggah modul materi…");
      const modulDoc = await uploadCourseDoc(uid, draftId, "modul", modul);

      setStep("Mengunggah penugasan akhir…");
      const tugasDoc = await uploadCourseDoc(uid, draftId, "tugas", tugas);

      setStep("Menyimpan kursus…");
      const result = await createCourse({
        title,
        shortDesc,
        longDesc,
        level,
        category,
        icon,
        duration,
        price: Number(price) || 0,
        videoUrl,
        modul: modulDoc,
        tugas: tugasDoc,
      });

      if (!result.ok) {
        setError(result.error);
        setStep(null);
        return;
      }

      router.replace(`/courses/${result.slug}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengunggah berkas. Silakan coba lagi.",
      );
      setStep(null);
    }
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

      {/* ── Keterangan kursus ───────────────────────────────── */}
      <section className="bg-paper-card border border-rule rounded-2xl p-7">
        <h2 className="t-h3 mb-1.5">Tentang Kursus</h2>
        <p className="t-body text-sm mb-6">Yang dilihat calon peserta di katalog.</p>

        <div className="space-y-4">
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

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="level">Tingkat</Label>
              <select id="level" value={level} onChange={(e) => setLevel(e.target.value)} className={inputClass}>
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
              <input
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="3 jam"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="price">Harga (Rp)</Label>
            <input
              id="price"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
            <p className="mt-2 text-xs text-ink-muted">Kosongkan atau isi 0 untuk kursus gratis.</p>
          </div>

          <div>
            <Label htmlFor="icon">Ikon</Label>
            <select id="icon" value={icon} onChange={(e) => setIcon(e.target.value)} className={inputClass}>
              {icons.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── Isi kursus ──────────────────────────────────────── */}
      <section className="bg-paper-card border border-rule rounded-2xl p-7">
        <h2 className="t-h3 mb-1.5">Isi Kursus</h2>
        <p className="t-body text-sm mb-6">Tiga bagian, semuanya wajib diisi.</p>

        <div className="space-y-7">
          <div>
            <h3 className="text-sm font-semibold text-ink mb-1">1. Modul Materi</h3>
            <p className="text-sm text-ink-muted mb-3">Bahan bacaan dalam bentuk PDF atau Word.</p>
            <FilePick id="modul" file={modul} error={modulError} onPick={pick("modul")} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink mb-1">2. Video Pembelajaran</h3>
            <p className="text-sm text-ink-muted mb-3">Tempel tautan YouTube.</p>
            <input
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className={cn(inputClass, !videoOk && "border-rust-700/50")}
              required
            />
            {!videoOk && (
              <p className="mt-2 text-sm text-rust-700">
                Tautan belum dikenali. Salin dari bilah alamat YouTube.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink mb-1">3. Penugasan Akhir</h3>
            <p className="text-sm text-ink-muted mb-3">Soal tugas dalam bentuk PDF atau Word.</p>
            <FilePick id="tugas" file={tugas} error={tugasError} onPick={pick("tugas")} />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Memproses…" : "Terbitkan Kursus"}
        </button>

        {/* Unggahan bisa memakan waktu, jadi langkahnya disebutkan —
            tombol yang diam saja membuat orang menekannya berulang kali. */}
        {step && <span className="text-sm text-ink-muted">{step}</span>}
      </div>

      <p className="text-xs text-ink-muted">
        Kursus langsung tampil di katalog setelah diterbitkan.
      </p>
    </form>
  );
}
