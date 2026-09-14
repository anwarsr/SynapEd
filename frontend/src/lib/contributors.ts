/**
 * Kontributor kursus dan pembagian persentasenya.
 *
 * Modul ini NETRAL dan tanpa impor alias `@/`: editor di browser memakainya
 * untuk pratinjau, server memakainya sebagai penjaga, dan skrip migrasi yang
 * dijalankan tsx di luar Next memakainya untuk hal yang sama.
 */

export interface Contributor {
  uid: string;
  /** Bilangan bulat 1..100. Seluruh share satu kursus berjumlah tepat 100. */
  share: number;
}

export const MAX_CONTRIBUTORS = 10; // termasuk pemilik
export const OWNER_MIN_SHARE = 10;
export const MIN_SHARE = 1;

export type BuildResult =
  | { ok: true; contributors: Contributor[] }
  | { ok: false; error: string };

/**
 * Menyusun daftar kontributor lengkap dari pemilik + kontributor lain.
 *
 * Jatah pemilik SELALU dihitung di sini sebagai sisa, tidak pernah diterima
 * dari pemanggil. Server Action bisa dipanggil lewat POST mentah, dan jatah
 * pemilik yang dikirim dari luar adalah angka yang bisa dikarang siapa saja —
 * mis. "pemilik 100% + kontributor 50%" yang totalnya 150%.
 */
export function buildContributors(
  ownerUid: string,
  others: readonly { uid: unknown; share: unknown }[],
): BuildResult {
  if (!ownerUid) return { ok: false, error: "Kursus ini tidak punya pemilik." };

  if (others.length > MAX_CONTRIBUTORS - 1) {
    return {
      ok: false,
      error: `Maksimal ${MAX_CONTRIBUTORS} kontributor, termasuk pemilik.`,
    };
  }

  const dipakai = new Set<string>([ownerUid]);
  const lain: Contributor[] = [];

  for (const o of others) {
    const uid = typeof o.uid === "string" ? o.uid.trim() : "";
    if (!uid) return { ok: false, error: "Ada kontributor tanpa akun." };

    if (uid === ownerUid) {
      return { ok: false, error: "Pemilik kursus sudah otomatis menjadi kontributor." };
    }
    if (dipakai.has(uid)) {
      return { ok: false, error: "Satu akun hanya boleh tercantum satu kali." };
    }

    const share = o.share;
    if (typeof share !== "number" || !Number.isInteger(share) || share < MIN_SHARE) {
      return { ok: false, error: `Persentase kontributor harus bilangan bulat minimal ${MIN_SHARE}%.` };
    }

    dipakai.add(uid);
    lain.push({ uid, share });
  }

  const jumlahLain = lain.reduce((n, c) => n + c.share, 0);
  const jatahPemilik = 100 - jumlahLain;

  if (jatahPemilik < OWNER_MIN_SHARE) {
    return {
      ok: false,
      error: `Bagian pemilik minimal ${OWNER_MIN_SHARE}%. Kurangi persentase kontributor lain.`,
    };
  }

  const contributors = [{ uid: ownerUid, share: jatahPemilik }, ...lain];

  // Penjaga terakhir — seharusnya mustahil gagal, tapi kalau suatu hari aturan
  // di atas diubah, lebih baik menolak daripada menyimpan pembagian yang salah.
  if (contributors.reduce((n, c) => n + c.share, 0) !== 100) {
    return { ok: false, error: "Total persentase harus tepat 100%." };
  }

  return { ok: true, contributors };
}

/**
 * Memvalidasi daftar yang SUDAH tersimpan (dari Firestore).
 *
 * Mengembalikan null bila bentuknya tidak sah, supaya pemanggil bisa memilih
 * nilai cadangan yang aman alih-alih mempercayai data yang rusak.
 */
export function parseStoredContributors(raw: unknown, ownerUid: string | null): Contributor[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || !ownerUid) return null;

  const [pertama, ...sisa] = raw as { uid?: unknown; share?: unknown }[];
  if (!pertama || pertama.uid !== ownerUid) return null;

  const hasil = buildContributors(ownerUid, sisa.map((c) => ({ uid: c.uid, share: c.share })));
  if (!hasil.ok) return null;

  // Jatah pemilik yang tersimpan harus sama dengan sisa yang dihitung ulang.
  if (hasil.contributors[0].share !== pertama.share) return null;

  return hasil.contributors;
}

/** Hanya kontributor selain pemilik — bentuk yang dikirim editor ke server. */
export function othersOf(contributors: readonly Contributor[], ownerUid: string): Contributor[] {
  return contributors.filter((c) => c.uid !== ownerUid);
}
