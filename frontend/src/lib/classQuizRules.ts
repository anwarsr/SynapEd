/**
 * Aturan quiz kelas: bentuk data, batas, validasi, penilaian, acak per siswa,
 * tenggat waktu, status, dan papan peringkat.
 *
 * Modul NETRAL - tanpa `server-only`, tanpa `use client`, tanpa impor `@/`:
 * builder & pengerja di browser memakainya untuk batas isian/penghitung waktu,
 * Server Action memeriksa ULANG semuanya, skrip verifikasi mengimpornya lewat
 * path relatif.
 *
 * Keputusan yang sudah disepakati pemilik:
 *  - poin per soal, total TEPAT 100 saat diterbitkan; ada "bagi rata";
 *  - pilihan ganda dinilai otomatis, esai dinilai manual oleh pengajar;
 *  - peringkat = nilai tertinggi, seri → pengerjaan tercepat, hanya yang
 *    sudah dinilai penuh;
 *  - setelah quiz DITUTUP siswa melihat nilai & kunci jawaban.
 */

// ── Batas ───────────────────────────────────────────────────────────────

export const TOTAL_POIN = 100;
export const MAX_SOAL = 50;
export const MIN_OPSI = 2;
export const MAX_OPSI = 6;
export const MAX_JUDUL_QUIZ = 120;
export const MAX_DESKRIPSI_QUIZ = 1000;
export const MAX_TEKS_SOAL = 1000;
export const MAX_TEKS_OPSI = 300;
export const MAX_JAWABAN_ESAI = 5000;
export const MAX_DURASI_MENIT = 600;
export const MAX_TAMBAH_MENIT = 600;
export const MAX_QUIZ_PER_KELAS = 30;
/** Toleransi jaringan: kiriman yang tiba sedikit setelah batas masih dihitung. */
export const TOLERANSI_DETIK = 5;

// ── Bentuk data ─────────────────────────────────────────────────────────

export type JenisSoal = "mcq" | "essay";

export interface OpsiSoal {
  id: string;
  text: string;
}

export interface SoalQuiz {
  id: string;
  type: JenisSoal;
  text: string;
  points: number;
  /** Kosong untuk esai. */
  options: OpsiSoal[];
  /** Id opsi yang benar; null untuk esai. RAHASIA sampai quiz ditutup. */
  correct: string | null;
}

export interface SetelanQuiz {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** Menit per siswa sejak menekan Mulai; null = tanpa batas waktu. */
  durationMin: number | null;
}

/**
 * Quiz dibuka? `opensAt` null = langsung terbuka begitu diterbitkan; selain itu
 * siswa baru bisa menekan Mulai pada/setelah jam itu (jam SERVER yang berwenang).
 */
export function sudahDibuka(quiz: { opensAt: string | null }, sekarang: number): boolean {
  return quiz.opensAt === null || sekarang >= Date.parse(quiz.opensAt);
}

export interface Quiz {
  id: string;
  classId: string;
  authorUid: string;
  title: string;
  description: string;
  questions: SoalQuiz[];
  settings: SetelanQuiz;
  published: boolean;
  /** ISO. null = mulai begitu diterbitkan; selain itu jadwal mulai (siswa belum bisa Mulai sebelumnya). */
  opensAt: string | null;
  /** Ditutup manual pengajar: tak ada yang bisa mulai/mengumpulkan lagi, kunci dibuka. */
  closed: boolean;
  /** Tambahan waktu untuk SEMUA siswa (menit). */
  extraMin: number;
  createdAt: string;
  updatedAt: string;
}

export interface UrutanSiswa {
  /** Id soal menurut urutan yang dilihat siswa ini. */
  q: string[];
  /** Id opsi per soal pilihan ganda menurut urutan siswa ini. */
  opt: Record<string, string[]>;
}

export interface PercobaanQuiz {
  /** `{classId}_{quizId}_{uid}` - deterministik: satu percobaan per siswa. */
  id: string;
  classId: string;
  quizId: string;
  uid: string;
  startedAt: string;
  submittedAt: string | null;
  /** Mengapa percobaan selesai: siswa sendiri, waktu habis, atau quiz ditutup. */
  finalizedBy: "siswa" | "waktu" | "ditutup" | null;
  /** soalId → id opsi (pilihan ganda) atau teks (esai). */
  answers: Record<string, string>;
  order: UrutanSiswa;
  /** Tambahan waktu khusus siswa ini (detik). */
  extraSec: number;
  /** Poin esai dari pengajar: soalId → poin. */
  essayScores: Record<string, number>;
}

// ── Util umum ───────────────────────────────────────────────────────────

export type Hasil<T> = { ok: true; value: T } | { ok: false; error: string };

function teks(raw: unknown, maks: number): string {
  return typeof raw === "string" ? raw.replace(/\r/g, "").trim().slice(0, maks) : "";
}

const RE_ID = /^[a-z0-9]{1,16}$/;

export function idBaru(ada: readonly string[]): string {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 8);
    if (id && !ada.includes(id)) return id;
  }
}

/**
 * Membagi `total` poin ke `n` soal sebagai bilangan bulat yang berjumlah tepat
 * `total`. Sisa pembagian dibagikan satu-satu dari soal pertama.
 */
export function bagiRataPoin(n: number, total = TOTAL_POIN): number[] {
  if (n <= 0) return [];
  const dasar = Math.floor(total / n);
  const sisa = total - dasar * n;
  return Array.from({ length: n }, (_, i) => dasar + (i < sisa ? 1 : 0));
}

export function jumlahPoin(soal: readonly { points: number }[]): number {
  return soal.reduce((n, s) => n + s.points, 0);
}

// ── Validasi masukan builder ────────────────────────────────────────────

export interface IsiQuiz {
  title: string;
  description: string;
  questions: SoalQuiz[];
  settings: SetelanQuiz;
  opensAt: string | null;
}

/**
 * Memeriksa quiz kiriman builder.
 *
 * `terbitkan`: pemeriksaan penuh (minimal 1 soal, pilihan ganda berkunci,
 * total poin TEPAT 100). Draf boleh belum lengkap, tetapi total tidak boleh
 * melebihi 100 dan tiap bidang tetap harus bentuknya sah.
 */
export function validasiQuiz(raw: unknown, terbitkan: boolean): Hasil<IsiQuiz> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const title = teks(r.title, MAX_JUDUL_QUIZ);
  if (title.length < 3) return { ok: false, error: "Judul quiz minimal 3 karakter." };

  const mentah = Array.isArray(r.questions) ? r.questions : [];
  if (mentah.length > MAX_SOAL) return { ok: false, error: `Maksimal ${MAX_SOAL} soal.` };

  const soalIds = new Set<string>();
  const questions: SoalQuiz[] = [];

  for (let i = 0; i < mentah.length; i++) {
    const q = mentah[i] && typeof mentah[i] === "object" ? (mentah[i] as Record<string, unknown>) : {};
    const no = i + 1;

    const id = typeof q.id === "string" && RE_ID.test(q.id) ? q.id : "";
    if (!id || soalIds.has(id)) return { ok: false, error: `Soal ${no} tidak sah.` };
    soalIds.add(id);

    const type: JenisSoal = q.type === "essay" ? "essay" : "mcq";
    const text = teks(q.text, MAX_TEKS_SOAL);
    if (!text && terbitkan) return { ok: false, error: `Soal ${no} belum ada pertanyaannya.` };

    const points = typeof q.points === "number" ? q.points : Number(q.points);
    if (!Number.isInteger(points) || points < 0 || points > TOTAL_POIN) {
      return { ok: false, error: `Poin soal ${no} harus bilangan bulat 0-${TOTAL_POIN}.` };
    }
    if (terbitkan && points < 1) return { ok: false, error: `Soal ${no} harus bernilai minimal 1 poin.` };

    let options: OpsiSoal[] = [];
    let correct: string | null = null;

    if (type === "mcq") {
      const o = Array.isArray(q.options) ? q.options : [];
      if (o.length > MAX_OPSI) return { ok: false, error: `Soal ${no}: maksimal ${MAX_OPSI} pilihan.` };
      const opsiIds = new Set<string>();
      for (const item of o) {
        const oo = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const oid = typeof oo.id === "string" && RE_ID.test(oo.id) ? oo.id : "";
        if (!oid || opsiIds.has(oid)) return { ok: false, error: `Pilihan pada soal ${no} tidak sah.` };
        opsiIds.add(oid);
        const t = teks(oo.text, MAX_TEKS_OPSI);
        if (!t && terbitkan) return { ok: false, error: `Soal ${no} punya pilihan yang masih kosong.` };
        options.push({ id: oid, text: t });
      }
      if (terbitkan && options.length < MIN_OPSI) {
        return { ok: false, error: `Soal ${no}: minimal ${MIN_OPSI} pilihan.` };
      }
      correct = typeof q.correct === "string" && opsiIds.has(q.correct) ? q.correct : null;
      if (terbitkan && !correct) return { ok: false, error: `Soal ${no}: tandai jawaban yang benar.` };
    } else {
      options = [];
    }

    questions.push({ id, type, text, points, options, correct });
  }

  const total = jumlahPoin(questions);
  if (total > TOTAL_POIN) return { ok: false, error: `Total poin ${total} melebihi ${TOTAL_POIN}.` };
  if (terbitkan) {
    if (questions.length === 0) return { ok: false, error: "Tambahkan minimal satu soal." };
    if (total !== TOTAL_POIN) {
      return { ok: false, error: `Total poin harus tepat ${TOTAL_POIN} (sekarang ${total}). Pakai "Bagi rata poin".` };
    }
  }

  const s = r.settings && typeof r.settings === "object" ? (r.settings as Record<string, unknown>) : {};
  let durationMin: number | null = null;
  if (s.durationMin !== null && s.durationMin !== undefined && s.durationMin !== "") {
    const d = typeof s.durationMin === "number" ? s.durationMin : Number(s.durationMin);
    if (!Number.isInteger(d) || d < 1 || d > MAX_DURASI_MENIT) {
      return { ok: false, error: `Waktu pengerjaan harus 1-${MAX_DURASI_MENIT} menit, atau kosongkan untuk tanpa batas.` };
    }
    durationMin = d;
  }

  // Jadwal mulai: kosong = langsung. Tanggal lampau sah (artinya sudah terbuka).
  let opensAt: string | null = null;
  if (r.opensAt !== null && r.opensAt !== undefined && r.opensAt !== "") {
    const t = typeof r.opensAt === "string" ? Date.parse(r.opensAt) : NaN;
    if (!Number.isFinite(t)) return { ok: false, error: "Tanggal & jam mulai quiz tidak valid." };
    opensAt = new Date(t).toISOString();
  }

  return {
    ok: true,
    value: {
      opensAt,
      title,
      description: teks(r.description, MAX_DESKRIPSI_QUIZ),
      questions,
      settings: {
        shuffleQuestions: s.shuffleQuestions === true,
        shuffleOptions: s.shuffleOptions === true,
        durationMin,
      },
    },
  };
}

/**
 * Soal boleh berubah hanya dalam poin setelah ada yang mengerjakan: teks,
 * jenis, pilihan, kunci, jumlah, dan urutan harus sama persis dengan yang lama.
 */
export function strukturSama(lama: readonly SoalQuiz[], baru: readonly SoalQuiz[]): boolean {
  if (lama.length !== baru.length) return false;
  return lama.every((a, i) => {
    const b = baru[i];
    return (
      a.id === b.id &&
      a.type === b.type &&
      a.text === b.text &&
      a.correct === b.correct &&
      a.options.length === b.options.length &&
      a.options.every((o, j) => o.id === b.options[j].id && o.text === b.options[j].text)
    );
  });
}

// ── Acak per siswa ──────────────────────────────────────────────────────

/** PRNG kecil bersemai (mulberry32) - hanya untuk mengacak urutan, bukan keamanan. */
function benih(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates bersemai: seed sama → urutan sama. Tidak mengubah masukan. */
export function acakBersemai<T>(daftar: readonly T[], seed: string): T[] {
  const rnd = benih(seed);
  const out = [...daftar];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Urutan yang dilihat SATU siswa. Disemai dari uid + id quiz, jadi dua siswa
 * hampir pasti mendapat urutan berbeda (sulit mencontek nomor demi nomor),
 * sedangkan siswa yang sama selalu mendapat urutan yang sama.
 */
export function urutanUntukSiswa(quiz: Pick<Quiz, "id" | "questions" | "settings">, uid: string): UrutanSiswa {
  const ids = quiz.questions.map((s) => s.id);
  const q = quiz.settings.shuffleQuestions ? acakBersemai(ids, `${quiz.id}:${uid}:q`) : ids;
  const opt: Record<string, string[]> = {};
  for (const s of quiz.questions) {
    if (s.type !== "mcq") continue;
    const oids = s.options.map((o) => o.id);
    opt[s.id] = quiz.settings.shuffleOptions ? acakBersemai(oids, `${quiz.id}:${uid}:${s.id}`) : oids;
  }
  return { q, opt };
}

/**
 * Mencocokkan urutan tersimpan dengan soal SEKARANG: soal/opsi yang sudah tak
 * ada dibuang, yang baru ditambahkan di belakang. Menjaga tampilan tetap utuh
 * walau quiz disunting setelah siswa mulai.
 */
export function urutanSahih(quiz: Pick<Quiz, "questions">, urutan: UrutanSiswa): UrutanSiswa {
  const ada = new Set(quiz.questions.map((s) => s.id));
  const q = urutan.q.filter((id) => ada.has(id));
  for (const s of quiz.questions) if (!q.includes(s.id)) q.push(s.id);

  const opt: Record<string, string[]> = {};
  for (const s of quiz.questions) {
    if (s.type !== "mcq") continue;
    const oids = new Set(s.options.map((o) => o.id));
    const lama = (urutan.opt[s.id] ?? []).filter((id) => oids.has(id));
    for (const o of s.options) if (!lama.includes(o.id)) lama.push(o.id);
    opt[s.id] = lama;
  }
  return { q, opt };
}

// ── Waktu ───────────────────────────────────────────────────────────────

/** Batas waktu percobaan (ms epoch), atau null bila quiz tanpa batas waktu. */
export function batasWaktuMs(quiz: Pick<Quiz, "settings" | "extraMin">, p: Pick<PercobaanQuiz, "startedAt" | "extraSec">): number | null {
  const d = quiz.settings.durationMin;
  if (d === null) return null;
  return Date.parse(p.startedAt) + (d + quiz.extraMin) * 60_000 + p.extraSec * 1000;
}

/** Sisa detik (≥ 0), atau null bila tanpa batas waktu. */
export function sisaDetik(quiz: Pick<Quiz, "settings" | "extraMin">, p: Pick<PercobaanQuiz, "startedAt" | "extraSec">, sekarang: number): number | null {
  const b = batasWaktuMs(quiz, p);
  return b === null ? null : Math.max(0, Math.ceil((b - sekarang) / 1000));
}

export type AlasanSelesai = "siswa" | "waktu" | "ditutup";

/**
 * Apakah percobaan yang belum dikumpulkan seharusnya sudah ditutup sekarang, dan
 * kapan "dikumpulkan"-nya dicatat: waktu habis dicatat TEPAT di batas (bukan
 * saat seseorang kebetulan membuka halaman), quiz ditutup dicatat saat ini.
 */
export function harusSelesai(
  quiz: Pick<Quiz, "settings" | "extraMin" | "closed">,
  p: Pick<PercobaanQuiz, "startedAt" | "extraSec" | "submittedAt">,
  sekarang: number,
): { alasan: AlasanSelesai; pada: number } | null {
  if (p.submittedAt) return null;
  const b = batasWaktuMs(quiz, p);
  if (b !== null && sekarang > b) return { alasan: "waktu", pada: b };
  if (quiz.closed) return { alasan: "ditutup", pada: sekarang };
  return null;
}

/** Lama pengerjaan (detik) sebuah percobaan yang sudah selesai. */
export function durasiDetik(p: Pick<PercobaanQuiz, "startedAt" | "submittedAt">): number | null {
  if (!p.submittedAt) return null;
  return Math.max(0, Math.round((Date.parse(p.submittedAt) - Date.parse(p.startedAt)) / 1000));
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatDurasi(detik: number): string {
  const d = Math.max(0, Math.floor(detik));
  const j = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = d % 60;
  const dua = (n: number) => String(n).padStart(2, "0");
  return j > 0 ? `${j}:${dua(m)}:${dua(s)}` : `${m}:${dua(s)}`;
}

// ── Penilaian ───────────────────────────────────────────────────────────

export interface RincianNilai {
  /** Poin pilihan ganda (otomatis). */
  otomatis: number;
  /** Poin esai yang sudah diberikan pengajar. */
  esai: number;
  total: number;
  /** Jumlah esai yang jawabannya belum diberi poin. */
  esaiBelumDinilai: number;
  /** Poin per soal. */
  perSoal: Record<string, number>;
}

/**
 * Nilai sebuah percobaan, dihitung ULANG tiap kali dari jawaban + kunci + poin
 * soal sekarang - bukan disimpan - sehingga mengubah poin soal otomatis
 * menghitung ulang semua nilai. Poin esai dijepit ke batas poin soalnya.
 */
export function hitungNilai(quiz: Pick<Quiz, "questions">, p: Pick<PercobaanQuiz, "answers" | "essayScores">): RincianNilai {
  let otomatis = 0;
  let esai = 0;
  let belum = 0;
  const perSoal: Record<string, number> = {};

  for (const s of quiz.questions) {
    if (s.type === "mcq") {
      const benar = s.correct !== null && p.answers[s.id] === s.correct;
      const n = benar ? s.points : 0;
      perSoal[s.id] = n;
      otomatis += n;
    } else {
      const skor = p.essayScores[s.id];
      if (typeof skor === "number") {
        const n = Math.min(Math.max(skor, 0), s.points);
        perSoal[s.id] = n;
        esai += n;
      } else {
        perSoal[s.id] = 0;
        belum++;
      }
    }
  }
  return { otomatis, esai, total: otomatis + esai, esaiBelumDinilai: belum, perSoal };
}

export type StatusQuizSiswa = "belum" | "berlangsung" | "perlu_dinilai" | "dinilai";

export const LABEL_STATUS_QUIZ: Record<StatusQuizSiswa, string> = {
  belum: "Belum mengerjakan",
  berlangsung: "Sedang mengerjakan",
  perlu_dinilai: "Menunggu penilaian esai",
  dinilai: "Selesai",
};

export function statusQuizSiswa(quiz: Pick<Quiz, "questions">, p: PercobaanQuiz | null): StatusQuizSiswa {
  if (!p) return "belum";
  if (!p.submittedAt) return "berlangsung";
  return hitungNilai(quiz, p).esaiBelumDinilai > 0 ? "perlu_dinilai" : "dinilai";
}

// ── Papan peringkat ─────────────────────────────────────────────────────

export interface BarisPeringkat {
  uid: string;
  nilai: number;
  detik: number;
}

/**
 * Tiga teratas: HANYA yang sudah dinilai penuh (esai selesai dikoreksi),
 * diurut nilai tertinggi; nilai sama → pengerjaan tercepat; masih sama →
 * yang mulai lebih dulu (supaya urutannya tak berubah-ubah tiap dibuka).
 */
export function peringkatTeratas(quiz: Pick<Quiz, "questions">, daftar: readonly PercobaanQuiz[], jumlah = 3): BarisPeringkat[] {
  return daftar
    .filter((p) => p.submittedAt && hitungNilai(quiz, p).esaiBelumDinilai === 0)
    .map((p) => ({ p, nilai: hitungNilai(quiz, p).total, detik: durasiDetik(p) ?? 0 }))
    .sort((a, b) => b.nilai - a.nilai || a.detik - b.detik || a.p.startedAt.localeCompare(b.p.startedAt))
    .slice(0, jumlah)
    .map(({ p, nilai, detik }) => ({ uid: p.uid, nilai, detik }));
}

// ── Normaliser (dipakai saat MEMBACA Firestore) ─────────────────────────

function str(v: unknown, bawaan = ""): string {
  return typeof v === "string" ? v : bawaan;
}

function soalDari(raw: unknown): SoalQuiz[] {
  if (!Array.isArray(raw)) return [];
  const out: SoalQuiz[] = [];
  for (const item of raw) {
    const q = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    if (typeof q.id !== "string" || !q.id) continue;
    const type: JenisSoal = q.type === "essay" ? "essay" : "mcq";
    const options: OpsiSoal[] =
      type === "mcq" && Array.isArray(q.options)
        ? q.options
            .map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>) : {}))
            .filter((o) => typeof o.id === "string" && o.id)
            .map((o) => ({ id: o.id as string, text: str(o.text) }))
        : [];
    out.push({
      id: q.id,
      type,
      text: str(q.text),
      points: typeof q.points === "number" && Number.isFinite(q.points) ? q.points : 0,
      options,
      correct: type === "mcq" && typeof q.correct === "string" && options.some((o) => o.id === q.correct) ? q.correct : null,
    });
  }
  return out;
}

export function toQuiz(id: string, d: Record<string, unknown>): Quiz {
  const s = d.settings && typeof d.settings === "object" ? (d.settings as Record<string, unknown>) : {};
  const dur = typeof s.durationMin === "number" && Number.isInteger(s.durationMin) && s.durationMin >= 1 ? s.durationMin : null;
  return {
    id,
    classId: str(d.classId),
    authorUid: str(d.authorUid),
    title: str(d.title),
    description: str(d.description),
    questions: soalDari(d.questions),
    settings: { shuffleQuestions: s.shuffleQuestions === true, shuffleOptions: s.shuffleOptions === true, durationMin: dur },
    published: d.published === true,
    opensAt: typeof d.opensAt === "string" && Number.isFinite(Date.parse(d.opensAt)) ? d.opensAt : null,
    closed: d.closed === true,
    extraMin: typeof d.extraMin === "number" && d.extraMin > 0 ? Math.floor(d.extraMin) : 0,
    createdAt: str(d.createdAt),
    updatedAt: str(d.updatedAt),
  };
}

function peta<T>(raw: unknown, cek: (v: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = cek(v);
      if (n !== null) out[k] = n;
    }
  }
  return out;
}

export function toPercobaan(id: string, d: Record<string, unknown>): PercobaanQuiz {
  const o = d.order && typeof d.order === "object" ? (d.order as Record<string, unknown>) : {};
  const alasan = d.finalizedBy;
  return {
    id,
    classId: str(d.classId),
    quizId: str(d.quizId),
    uid: str(d.uid),
    startedAt: str(d.startedAt),
    submittedAt: typeof d.submittedAt === "string" && d.submittedAt ? d.submittedAt : null,
    finalizedBy: alasan === "siswa" || alasan === "waktu" || alasan === "ditutup" ? alasan : null,
    answers: peta(d.answers, (v) => (typeof v === "string" ? v : null)),
    order: {
      q: Array.isArray(o.q) ? o.q.filter((x): x is string => typeof x === "string") : [],
      opt: peta(o.opt, (v) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null)),
    },
    extraSec: typeof d.extraSec === "number" && d.extraSec > 0 ? Math.floor(d.extraSec) : 0,
    essayScores: peta(d.essayScores, (v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
  };
}

/** Id dokumen percobaan: satu per siswa per quiz. */
export function idPercobaan(classId: string, quizId: string, uid: string): string {
  return `${classId}_${quizId}_${uid}`;
}

/**
 * Jawaban kiriman siswa → yang boleh disimpan: hanya soal yang ada, pilihan
 * ganda harus id opsi yang sah, esai dipotong ke batas. Selebihnya dibuang.
 */
export function bersihkanJawaban(quiz: Pick<Quiz, "questions">, raw: unknown): Record<string, string> {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const s of quiz.questions) {
    const v = r[s.id];
    if (typeof v !== "string") continue;
    if (s.type === "mcq") {
      if (s.options.some((o) => o.id === v)) out[s.id] = v;
    } else {
      const t = v.replace(/\r/g, "").slice(0, MAX_JAWABAN_ESAI);
      if (t.trim()) out[s.id] = t;
    }
  }
  return out;
}

/** Nilai esai kiriman pengajar → peta yang sah (soal esai, bulat 0..poin). Null = ada yang tak sah. */
export function validasiNilaiEsai(quiz: Pick<Quiz, "questions">, raw: unknown): Record<string, number> | null {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!r) return null;
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(r)) {
    const s = quiz.questions.find((x) => x.id === id);
    if (!s || s.type !== "essay") return null;
    const n = typeof v === "number" ? v : NaN;
    if (!Number.isInteger(n) || n < 0 || n > s.points) return null;
    out[id] = n;
  }
  return out;
}
