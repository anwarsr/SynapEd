"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCourseMeta } from "@/lib/curriculumActions";
import { Label, inputClass } from "./fields";
import { cn } from "@/lib/cn";

interface Option {
  readonly value: string;
  readonly label?: string;
}

/**
 * Menyunting judul, deskripsi, harga, dan metadata kursus — bukan
 * kurikulumnya. Dipisah dari CurriculumEditor supaya masing-masing punya
 * tombol simpan sendiri; menyimpan info kursus tidak perlu menunggu
 * kurikulum ikut divalidasi, dan sebaliknya.
 */
export default function CourseMetaForm({
  slug,
  initial,
  levels,
  categories,
  icons,
}: {
  slug: string;
  initial: {
    title: string;
    shortDesc: string;
    longDesc: string;
    level: string;
    category: string;
    icon: string;
    duration: string;
    price: number;
    whatYouLearn: string[];
    requirements: string[];
  };
  levels: readonly Option[];
  categories: readonly Option[];
  icons: readonly string[];
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [shortDesc, setShortDesc] = useState(initial.shortDesc);
  const [longDesc, setLongDesc] = useState(initial.longDesc);
  const [level, setLevel] = useState(initial.level);
  const [category, setCategory] = useState(initial.category);
  const [icon, setIcon] = useState(initial.icon);
  const [duration, setDuration] = useState(initial.duration);
  const [price, setPrice] = useState(String(initial.price));
  const [whatYouLearn, setWhatYouLearn] = useState(initial.whatYouLearn.join("\n"));
  const [requirements, setRequirements] = useState(initial.requirements.join("\n"));

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);

    const result = await updateCourseMeta(slug, {
      title,
      shortDesc,
      longDesc,
      level,
      category,
      icon,
      duration,
      price: Number(price) || 0,
      whatYouLearn: whatYouLearn.split("\n"),
      requirements: requirements.split("\n"),
    });

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
        <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}

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
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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
                className={inputClass}
              />
              <p className="mt-2 text-xs text-ink-muted">0 berarti gratis.</p>
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

          <div>
            <Label htmlFor="whatYouLearn">Yang akan dipelajari</Label>
            <textarea
              id="whatYouLearn"
              value={whatYouLearn}
              onChange={(e) => setWhatYouLearn(e.target.value)}
              rows={4}
              placeholder={"Satu baris satu poin.\nMemahami dasar EEG\nMenganalisis sinyal otak"}
              className={cn(inputClass, "resize-y")}
            />
          </div>

          <div>
            <Label htmlFor="requirements">Persyaratan</Label>
            <textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              placeholder={"Satu baris satu poin.\nLaptop dengan koneksi internet"}
              className={cn(inputClass, "resize-y")}
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-blue-600 px-7 py-3 text-sm font-semibold text-white transition-all duration-200 ease-out-soft hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed"
        >
          {pending ? "Menyimpan…" : "Simpan Info Kursus"}
        </button>
        {saved && <span className="text-sm text-blue-700">Tersimpan.</span>}
      </div>
    </form>
  );
}
