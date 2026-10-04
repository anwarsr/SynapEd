/**
 * Aturan tugas kelas: jenis postingan, format berkas, batas, tenggat, nilai,
 * dan status pengumpulan.
 *
 * Modul NETRAL — tanpa `server-only`, tanpa `use client`, tanpa impor `@/`.
 * Formulir di browser memakainya untuk `accept`, `maxLength`, dan pesan
 * galat seketika; Server Action memakainya untuk memeriksa ULANG semuanya;
 * skrip verifikasi mengimpornya lewat path relatif. Tiga salinan aturan yang
 * sama pasti melenceng, dan yang melenceng di sini berarti formulir menerima
 * berkas yang lalu ditolak server tanpa alasan yang bisa dipahami siswa.
 */

// ── Batas ───────────────────────────────────────────────────────────────

export const MAX_ASSIGNMENT_TITLE = 120;
/** Jawaban teks siswa. Esai panjang tetap muat; tempelan buku tidak. */
export const MAX_ANSWER_TEXT = 10_000;
export const MAX_CLASS_FEEDBACK = 2000;

/** Lampiran pengajar per postingan, dan berkas siswa per pengumpulan. */
export const MAX_FILES_PER_POST = 5;
export const MAX_FILES_PER_SUBMISSION = 5;

/**
 * Ukuran maksimal SATU berkas (eksklusif: harus lebih KECIL dari ini).
 * Sejalan dengan storage.rules (`size < 20 * 1024 * 1024`) — jangan ubah
 * salah satunya saja.
 */
export const MAX_CLASS_FILE_BYTES = 20 * 1024 * 1024;

export const DEFAULT_MAX_POINTS = 100;
export const MAX_POINTS_LIMIT = 1000;

// ── Jenis postingan & format ────────────────────────────────────────────

/** Postingan lama tidak punya field `kind` — dibaca sebagai pengumuman. */
export type JenisPost = "announcement" | "assignment";

/** Format yang boleh dipakai siswa untuk mengumpulkan; dipilih per tugas. */
export type FormatTugas = "text" | "pdfImage" | "office" | "zip";

export const FORMAT_TUGAS: readonly FormatTugas[] = ["text", "pdfImage", "office", "zip"];

export const INFO_FORMAT: Record<FormatTugas, { label: string; ket: string }> = {
  text: { label: "Teks jawaban", ket: "Diketik langsung di halaman tugas" },
  pdfImage: { label: "PDF & gambar", ket: "PDF, JPG, PNG" },
  office: { label: "Dokumen Office", ket: "Word, PowerPoint, Excel (.docx, .pptx, .xlsx)" },
  zip: { label: "Arsip ZIP", ket: "Satu berkas .zip berisi banyak berkas" },
};

/**
 * Ekstensi → MIME baku, dan format tugas pemiliknya.
 *
 * Klien MENGUNGGAH dengan MIME dari tabel ini, bukan `file.type`: Windows
 * melaporkan ZIP sebagai `application/x-zip-compressed`, dan sebagian
 * browser mengosongkan `file.type` untuk berkas Office. storage.rules
 * memeriksa daftar tertutup yang sama, lalu server membaca ulang MIME yang
 * benar-benar tersimpan — bukan yang dikatakan browser.
 *
 * Daftar tertutup, bukan pola: `application/.*` ikut meloloskan berkas yang
 * bisa dieksekusi.
 */
const BERKAS: Record<string, { mime: string; format: Exclude<FormatTugas, "text"> }> = {
  ".pdf": { mime: "application/pdf", format: "pdfImage" },
  ".jpg": { mime: "image/jpeg", format: "pdfImage" },
  ".jpeg": { mime: "image/jpeg", format: "pdfImage" },
  ".png": { mime: "image/png", format: "pdfImage" },
  ".docx": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    format: "office",
  },
  ".pptx": {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    format: "office",
  },
  ".xlsx": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    format: "office",
  },
  ".zip": { mime: "application/zip", format: "zip" },
};

/** Seluruh MIME yang dikenal — yang boleh dipakai lampiran PENGAJAR. */
export const MIME_KELAS: readonly string[] = [...new Set(Object.values(BERKAS).map((b) => b.mime))];

export function ekstensiOf(name: string): string {
  const m = /\.[A-Za-z0-9]+$/.exec(name);
  return m ? m[0].toLowerCase() : "";
}

/** MIME baku sebuah nama berkas, atau null kalau ekstensinya tidak dikenal. */
export function mimeOfName(name: string): string | null {
  return BERKAS[ekstensiOf(name)]?.mime ?? null;
}

export function formatOfMime(mime: string): FormatTugas | null {
  for (const b of Object.values(BERKAS)) if (b.mime === mime) return b.format;
  return null;
}

/** MIME yang boleh dikumpulkan untuk sebuah tugas. `text` tidak menyumbang apa pun. */
export function mimeUntukFormat(formats: readonly FormatTugas[]): string[] {
  const out = new Set<string>();
  for (const b of Object.values(BERKAS)) if (formats.includes(b.format)) out.add(b.mime);
  return [...out];
}

/** Nilai atribut `accept` untuk `<input type="file">`. */
export function acceptUntuk(formats: readonly FormatTugas[] | null): string {
  return Object.entries(BERKAS)
    .filter(([, b]) => formats === null || formats.includes(b.format))
    .map(([ext]) => ext)
    .join(",");
}

/** Tugas yang hanya menerima teks tidak menampilkan pemilih berkas sama sekali. */
export function terimaBerkas(formats: readonly FormatTugas[]): boolean {
  return formats.some((f) => f !== "text");
}

/**
 * Galat untuk satu berkas pilihan, atau null.
 *
 * `formats` null = lampiran pengajar (seluruh jenis yang dikenal).
 */
export function galatBerkas(
  file: { name: string; size: number },
  formats: readonly FormatTugas[] | null,
): string | null {
  const mime = mimeOfName(file.name);
  const format = mime ? formatOfMime(mime) : null;

  if (!mime || !format || (formats !== null && !formats.includes(format))) {
    const izin = formats === null ? null : formats.filter((f) => f !== "text").map((f) => INFO_FORMAT[f].label);
    return izin && izin.length > 0
      ? `"${file.name}" tidak diterima. Format yang diminta: ${izin.join(", ")}.`
      : `"${file.name}" tidak diterima. Format yang didukung: PDF, JPG, PNG, DOCX, PPTX, XLSX, ZIP.`;
  }
  if (file.size <= 0) return `"${file.name}" kosong.`;
  if (file.size >= MAX_CLASS_FILE_BYTES) return `"${file.name}" melebihi 20 MB.`;
  return null;
}

// ── Bentuk data ─────────────────────────────────────────────────────────

/** Satu berkas yang tercatat di Firestore. Ukuran & MIME dibaca SERVER dari Storage. */
export interface KelasBerkas {
  name: string;
  path: string;
  size: number;
  mime: string;
}

export interface PengaturanTugas {
  formats: FormatTugas[];
  /** ISO. null = tanpa tenggat. */
  dueAt: string | null;
  /** Hanya berarti bila ada tenggat. */
  acceptLate: boolean;
  maxPoints: number;
}

export type StatusSubmission = "submitted" | "graded";

export interface KelasSubmission {
  /** `{classId}_{postId}_{uid}` — deterministik, jadi klik ganda tidak menggandakan. */
  id: string;
  classId: string;
  postId: string;
  uid: string;
  text: string;
  files: KelasBerkas[];
  status: StatusSubmission;
  /** Dibekukan saat mengumpulkan; tenggat yang diundur kemudian tidak menghapusnya. */
  late: boolean;
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
  gradedAt: string | null;
  gradedByUid: string | null;
}

// ── Normaliser (dipakai saat MEMBACA Firestore) ─────────────────────────

export function toBerkasList(raw: unknown): KelasBerkas[] {
  if (!Array.isArray(raw)) return [];
  const out: KelasBerkas[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const r = b as Record<string, unknown>;
    if (typeof r.path !== "string" || !r.path) continue;
    out.push({
      name: typeof r.name === "string" && r.name ? r.name : "berkas",
      path: r.path,
      size: typeof r.size === "number" && r.size > 0 ? r.size : 0,
      mime: typeof r.mime === "string" ? r.mime : "application/octet-stream",
    });
  }
  return out;
}

function toFormats(raw: unknown): FormatTugas[] {
  const daftar = Array.isArray(raw) ? raw : [];
  const sah = FORMAT_TUGAS.filter((f) => daftar.includes(f));
  // Dokumen rusak tanpa satu format pun: lebih aman menerima teks saja
  // daripada tugas yang tidak bisa dikumpulkan sama sekali.
  return sah.length > 0 ? sah : ["text"];
}

function isoAtauNull(raw: unknown): string | null {
  return typeof raw === "string" && raw !== "" && Number.isFinite(Date.parse(raw)) ? raw : null;
}

export function toPengaturan(raw: unknown): PengaturanTugas {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const poin = r.maxPoints;
  return {
    formats: toFormats(r.formats),
    dueAt: isoAtauNull(r.dueAt),
    acceptLate: r.acceptLate === true,
    maxPoints:
      typeof poin === "number" && Number.isInteger(poin) && poin >= 1 && poin <= MAX_POINTS_LIMIT
        ? poin
        : DEFAULT_MAX_POINTS,
  };
}

// ── Validasi masukan (dipakai Server Action) ────────────────────────────

export type Hasil<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Memeriksa pengaturan tugas dari formulir.
 *
 * `wajibMasaDepan` hanya saat MEMBUAT: tugas baru yang tenggatnya sudah
 * lewat hampir pasti salah ketik tanggal. Saat MENGUBAH, tenggat lampau
 * justru sah — begitulah pengajar menutup pengumpulan lebih awal.
 */
export function validasiPengaturan(
  raw: unknown,
  sekarang: number,
  wajibMasaDepan: boolean,
): Hasil<PengaturanTugas> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const daftar = Array.isArray(r.formats) ? r.formats : [];
  const formats = FORMAT_TUGAS.filter((f) => daftar.includes(f));
  if (formats.length === 0) return { ok: false, error: "Pilih minimal satu format pengumpulan." };

  let dueAt: string | null = null;
  if (r.dueAt !== null && r.dueAt !== undefined && r.dueAt !== "") {
    const t = typeof r.dueAt === "string" ? Date.parse(r.dueAt) : NaN;
    if (!Number.isFinite(t)) return { ok: false, error: "Tenggat tidak valid." };
    if (wajibMasaDepan && t <= sekarang) return { ok: false, error: "Tenggat harus di masa depan." };
    dueAt = new Date(t).toISOString();
  }

  const poin = typeof r.maxPoints === "number" ? r.maxPoints : Number(r.maxPoints);
  if (!Number.isInteger(poin) || poin < 1 || poin > MAX_POINTS_LIMIT) {
    return { ok: false, error: `Nilai maksimal harus bilangan bulat 1–${MAX_POINTS_LIMIT}.` };
  }

  return {
    ok: true,
    value: { formats, dueAt, acceptLate: dueAt !== null && r.acceptLate === true, maxPoints: poin },
  };
}

/** Nilai bilangan bulat 0..maxPoints, atau null. Tidak pernah dibulatkan diam-diam. */
export function validasiNilai(raw: unknown, maxPoints: number): number | null {
  const n = typeof raw === "number" ? raw : NaN;
  return Number.isInteger(n) && n >= 0 && n <= maxPoints ? n : null;
}

// ── Tenggat & status ────────────────────────────────────────────────────

export function lewatTenggat(dueAt: string | null, saat: number): boolean {
  return dueAt !== null && saat > Date.parse(dueAt);
}

/** Pengumpulan baru (atau pembatalan) masih diterima pada saat ini. */
export function masihDibuka(p: PengaturanTugas, saat: number): boolean {
  return !lewatTenggat(p.dueAt, saat) || p.acceptLate;
}

export type StatusTugas = "belum" | "terlewat" | "dikumpulkan" | "terlambat" | "dinilai";

export function statusTugas(
  sub: Pick<KelasSubmission, "status" | "late"> | null,
  p: PengaturanTugas,
  saat: number,
): StatusTugas {
  if (!sub) return lewatTenggat(p.dueAt, saat) ? "terlewat" : "belum";
  if (sub.status === "graded") return "dinilai";
  return sub.late ? "terlambat" : "dikumpulkan";
}

/** Nada mengikuti `Tag`: label teks selalu ada, warna hanya penegas. */
export const LABEL_STATUS: Record<StatusTugas, { label: string; tone: "neutral" | "blue" | "amber" | "rust" }> = {
  belum: { label: "Belum mengumpulkan", tone: "neutral" },
  terlewat: { label: "Belum · lewat tenggat", tone: "rust" },
  dikumpulkan: { label: "Dikumpulkan", tone: "blue" },
  terlambat: { label: "Terlambat", tone: "amber" },
  dinilai: { label: "Dinilai", tone: "blue" },
};

// ── Waktu dalam WIB ─────────────────────────────────────────────────────
//
// Tenggat ditulis dan dibaca dalam WIB, bukan zona browser maupun zona
// server. Server App Hosting berjalan dalam UTC: tanpa zona eksplisit,
// "23.59" yang diketik pengajar akan tampil "16.59" di halaman siswa. Zona
// tetap juga membuat render server dan klien identik (tanpa hydration
// mismatch), dan label "WIB" membuat siswa di WITA/WIT tidak salah kira.

const OFFSET_WIB = "+07:00";
const JAM_WIB_MS = 7 * 60 * 60 * 1000;

/** `2026-10-05T23:59` (diketik di input datetime-local, dianggap WIB) → ISO UTC. */
export function inputWibKeIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}:00${OFFSET_WIB}`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Kebalikan `inputWibKeIso`, untuk mengisi ulang input datetime-local. */
export function isoKeInputWib(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + JAM_WIB_MS).toISOString().slice(0, 16);
}

export function formatWib(iso: string | null): string {
  if (!iso) return "—";
  const teks = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
  return `${teks} WIB`;
}
