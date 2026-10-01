/**
 * Bentuk isi profil pengguna.
 *
 * Modul ini NETRAL — tanpa "use client" maupun "server-only" — karena dipakai
 * form penyuntingan di browser DAN validator di server. Menaruhnya di berkas
 * ber-"server-only" akan mematahkan build begitu form mengimpornya, persis
 * seperti yang pernah terjadi pada roles.ts, providerIds.ts, storagePaths.ts,
 * dan courseRequestTypes.ts.
 */

export const JENJANG = [
  "SMA / SMK",
  "D3",
  "D4",
  "S1",
  "S2",
  "S3",
  "Lainnya",
] as const;

export type Jenjang = (typeof JENJANG)[number];

export interface EducationEntry {
  /** Kunci stabil untuk daftar di React — bukan disimpan sebagai identitas. */
  id: string;
  institution: string;
  level: string;
  major: string;
  /** null berarti belum diisi. */
  startYear: number | null;
  /** null berarti masih berjalan — dirender sebagai "sekarang". */
  endYear: number | null;
}

export interface ProfileContent {
  bio: string;
  education: EducationEntry[];
  skills: string[];
}

export const MAX_BIO = 600;
export const MAX_SKILLS = 12;
export const MAX_SKILL_LENGTH = 30;
export const MAX_EDUCATION = 10;

/** Batas tahun yang masuk akal — cukup longgar, tapi menolak salah ketik. */
export const MIN_YEAR = 1950;
export const MAX_YEAR = new Date().getFullYear() + 10;

export const EMPTY_PROFILE: ProfileContent = { bio: "", education: [], skills: [] };

function cleanText(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function cleanYear(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;

  const tahun = Math.trunc(n);
  return tahun >= MIN_YEAR && tahun <= MAX_YEAR ? tahun : null;
}

/**
 * Membersihkan satu entri pendidikan. `null` berarti entri kosong yang layak
 * dibuang — bukan galat.
 *
 * Nama institusi adalah satu-satunya yang wajib: entri tanpa itu tidak berarti
 * apa-apa bagi pembaca, sementara jurusan dan tahun sering memang tidak
 * relevan (kursus singkat, sekolah kejuruan).
 */
export function cleanEducation(raw: unknown, index: number): EducationEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;

  const institution = cleanText(e.institution, 120);
  if (!institution) return null;

  const level = JENJANG.includes(cleanText(e.level, 40) as Jenjang)
    ? cleanText(e.level, 40)
    : "Lainnya";

  const startYear = cleanYear(e.startYear);
  let endYear = cleanYear(e.endYear);

  // Selesai sebelum mulai tidak mungkin. Dianggap "masih berjalan" alih-alih
  // ditolak — pengguna sedang mengetik, dan menolak simpan karena satu digit
  // setengah jadi lebih menjengkelkan daripada berguna.
  if (startYear !== null && endYear !== null && endYear < startYear) endYear = null;

  return {
    id: cleanText(e.id, 40) || `edu-${index}`,
    institution,
    level,
    major: cleanText(e.major, 120),
    startYear,
    endYear,
  };
}

/** Membakukan seluruh isi profil. Dipakai Server Action sebelum menyimpan. */
export function cleanProfile(raw: unknown): ProfileContent {
  const p = (raw ?? {}) as Record<string, unknown>;

  const education = Array.isArray(p.education)
    ? p.education
        .slice(0, MAX_EDUCATION)
        .map((e, i) => cleanEducation(e, i))
        .filter((e): e is EducationEntry => e !== null)
    : [];

  const skills = Array.isArray(p.skills)
    ? Array.from(
        // Set membuang duplikat; huruf besar-kecil dibiarkan apa adanya karena
        // "EEG" dan "eeg" ditulis berbeda dengan maksud yang berbeda pula.
        new Set(
          p.skills
            .map((s) => cleanText(s, MAX_SKILL_LENGTH))
            .filter(Boolean),
        ),
      ).slice(0, MAX_SKILLS)
    : [];

  return { bio: cleanText(p.bio, MAX_BIO), education, skills };
}

/** "2019 – 2023", "2019 – sekarang", atau "" kalau tahunnya tidak diisi. */
export function formatYears(entry: EducationEntry): string {
  if (entry.startYear === null && entry.endYear === null) return "";
  if (entry.startYear === null) return String(entry.endYear);
  return `${entry.startYear} – ${entry.endYear ?? "sekarang"}`;
}

/** Sejalan dengan batas lama di firestore.rules. */
export const MAX_PHONE = 20;

/**
 * Validasi longgar: hanya bentuk umum nomor Indonesia/internasional.
 *
 * Dipakai form (umpan balik saat itu juga) DAN Server Action (penjaga yang
 * sebenarnya — action bisa dipanggil lewat POST mentah tanpa melewati form).
 */
export function validatePhone(raw: string): string | null {
  const v = raw.trim();
  if (v === "") return null; // kosong = menghapus nomor, itu sah

  if (v.length > MAX_PHONE || !/^[+]?[\d\s()-]{8,20}$/.test(v)) {
    return "Nomor tidak valid. Contoh: 0812-3456-7890 atau +62 812 3456 7890.";
  }
  if (v.replace(/\D/g, "").length < 8) return "Nomor terlalu pendek.";
  return null;
}
