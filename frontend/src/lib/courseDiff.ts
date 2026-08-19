import type { Section } from "@/lib/courses";
import type { CourseSnapshot } from "@/lib/courseRequests";

/**
 * Membandingkan dua versi kursus dan menjelaskan apa yang berubah.
 *
 * Bukan berkas "server-only": halaman admin merendernya di server, tetapi
 * fungsinya murni — tanpa Firestore, tanpa sesi — sehingga bisa diuji
 * langsung tanpa menjalankan aplikasi.
 *
 * Yang dihasilkan sengaja berupa kalimat siap baca, bukan selisih JSON mentah.
 * Admin perlu memutuskan cepat: "harga 450.000 -> 500.000" menjawab itu,
 * sedangkan tumpukan kurung kurawal tidak.
 */

export type ChangeKind = "added" | "removed" | "changed" | "moved";

export interface Change {
  kind: ChangeKind;
  /** Bagian mana yang berubah, mis. "Harga" atau "Bagian 2 · Pelajaran 3". */
  field: string;
  before?: string;
  after?: string;
}

export const changeKindLabel: Record<ChangeKind, string> = {
  added: "Ditambah",
  removed: "Dihapus",
  changed: "Diubah",
  moved: "Dipindah",
};

function text(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function rupiah(v: number): string {
  return v > 0 ? new Intl.NumberFormat("id-ID").format(v) : "Gratis";
}

/** Perbandingan daftar poin (whatYouLearn / requirements) sebagai satu kesatuan. */
function listChanged(a: string[], b: string[]): boolean {
  return a.length !== b.length || a.some((v, i) => v !== b[i]);
}

const META_FIELDS: {
  label: string;
  read: (s: CourseSnapshot) => string;
}[] = [
  { label: "Judul", read: (s) => text(s.title) },
  { label: "Deskripsi singkat", read: (s) => text(s.shortDesc) },
  { label: "Deskripsi lengkap", read: (s) => text(s.longDesc) },
  { label: "Tingkat", read: (s) => text(s.level) },
  { label: "Kategori", read: (s) => text(s.category) },
  { label: "Durasi", read: (s) => text(s.duration) },
  { label: "Harga", read: (s) => rupiah(s.price) },
  { label: "Gambar latar", read: (s) => (s.thumbnail ? "ada" : "tidak ada") },
];

/** Kunci pelajaran: slug kalau ada, kalau tidak jatuh ke judulnya. */
function lessonKey(l: { slug?: string; title: string }): string {
  return l.slug?.trim() || `judul:${l.title.trim().toLowerCase()}`;
}

function describeLesson(l: { title: string; type: string; duration: string }): string {
  return `${l.title} (${l.type}${l.duration ? `, ${l.duration}` : ""})`;
}

function diffCurriculum(before: Section[], after: Section[]): Change[] {
  const out: Change[] = [];

  // ── Bagian ──────────────────────────────────────────────────────────
  const beforeTitles = before.map((s) => s.title);
  const afterTitles = after.map((s) => s.title);

  for (const [i, s] of after.entries()) {
    if (!beforeTitles.includes(s.title)) {
      out.push({
        kind: "added",
        field: `Bagian ${i + 1}`,
        after: `${s.title} (${s.lessons.length} pelajaran)`,
      });
    }
  }
  for (const [i, s] of before.entries()) {
    if (!afterTitles.includes(s.title)) {
      out.push({
        kind: "removed",
        field: `Bagian ${i + 1}`,
        before: `${s.title} (${s.lessons.length} pelajaran)`,
      });
    }
  }

  // Bagian yang namanya tetap tapi urutannya bergeser.
  for (const [i, s] of after.entries()) {
    const oldIndex = beforeTitles.indexOf(s.title);
    if (oldIndex !== -1 && oldIndex !== i) {
      out.push({
        kind: "moved",
        field: `Bagian "${s.title}"`,
        before: `urutan ke-${oldIndex + 1}`,
        after: `urutan ke-${i + 1}`,
      });
    }
  }

  // ── Pelajaran, dibandingkan lintas seluruh kurikulum ────────────────
  //
  // Sengaja tidak per bagian: pelajaran yang dipindah ke bagian lain akan
  // terbaca sebagai "dihapus lalu ditambah" kalau dibandingkan per bagian,
  // padahal isinya sama persis.
  const flat = (secs: Section[]) =>
    secs.flatMap((s) =>
      s.lessons.map((l) => ({ ...l, sectionTitle: s.title, key: lessonKey(l) })),
    );

  const beforeLessons = flat(before);
  const afterLessons = flat(after);
  const beforeByKey = new Map(beforeLessons.map((l) => [l.key, l]));
  const afterByKey = new Map(afterLessons.map((l) => [l.key, l]));

  for (const l of afterLessons) {
    if (!beforeByKey.has(l.key)) {
      out.push({
        kind: "added",
        field: `Pelajaran di "${l.sectionTitle}"`,
        after: describeLesson(l),
      });
    }
  }

  for (const l of beforeLessons) {
    if (!afterByKey.has(l.key)) {
      out.push({
        kind: "removed",
        field: `Pelajaran di "${l.sectionTitle}"`,
        before: describeLesson(l),
      });
    }
  }

  for (const l of afterLessons) {
    const old = beforeByKey.get(l.key);
    if (!old) continue;

    if (old.title !== l.title) {
      out.push({ kind: "changed", field: "Judul pelajaran", before: old.title, after: l.title });
    }
    if (old.type !== l.type) {
      out.push({ kind: "changed", field: `Jenis "${l.title}"`, before: old.type, after: l.type });
    }
    if (old.duration !== l.duration) {
      out.push({
        kind: "changed",
        field: `Durasi "${l.title}"`,
        before: text(old.duration),
        after: text(l.duration),
      });
    }
    if ((old.videoUrl ?? "") !== (l.videoUrl ?? "")) {
      out.push({
        kind: "changed",
        field: `Video "${l.title}"`,
        before: text(old.videoUrl),
        after: text(l.videoUrl),
      });
    }

    const oldFile = old.attachments?.[0]?.name ?? "";
    const newFile = l.attachments?.[0]?.name ?? "";
    if (oldFile !== newFile) {
      out.push({
        kind: "changed",
        field: `Berkas materi "${l.title}"`,
        before: text(oldFile),
        after: text(newFile),
      });
    }

    if (old.sectionTitle !== l.sectionTitle) {
      out.push({
        kind: "moved",
        field: `Pelajaran "${l.title}"`,
        before: old.sectionTitle,
        after: l.sectionTitle,
      });
    }
  }

  return out;
}

/** Seluruh perbedaan antara dua versi kursus. Kosong berarti tidak ada yang berubah. */
export function diffCourse(before: CourseSnapshot, after: CourseSnapshot): Change[] {
  const out: Change[] = [];

  for (const f of META_FIELDS) {
    const a = f.read(before);
    const b = f.read(after);
    if (a !== b) out.push({ kind: "changed", field: f.label, before: a, after: b });
  }

  for (const [label, key] of [
    ["Yang akan dipelajari", "whatYouLearn"],
    ["Persyaratan", "requirements"],
  ] as const) {
    const a = before[key] ?? [];
    const b = after[key] ?? [];
    if (listChanged(a, b)) {
      out.push({
        kind: "changed",
        field: label,
        before: a.length ? `${a.length} poin` : "kosong",
        after: b.length ? `${b.length} poin` : "kosong",
      });
    }
  }

  out.push(...diffCurriculum(before.sections ?? [], after.sections ?? []));

  return out;
}

/** Ringkasan sebaris untuk daftar notifikasi admin. */
export function summariseChanges(changes: Change[]): string {
  if (changes.length === 0) return "Tidak ada perubahan terdeteksi";

  const n = { added: 0, removed: 0, changed: 0, moved: 0 };
  for (const c of changes) n[c.kind]++;

  const bagian: string[] = [];
  if (n.changed) bagian.push(`${n.changed} diubah`);
  if (n.added) bagian.push(`${n.added} ditambah`);
  if (n.removed) bagian.push(`${n.removed} dihapus`);
  if (n.moved) bagian.push(`${n.moved} dipindah`);

  return bagian.join(", ");
}
