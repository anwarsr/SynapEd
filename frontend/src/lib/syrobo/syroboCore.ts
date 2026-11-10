/**
 * Penulis data SyRobo. Tanpa `server-only` dan tanpa impor alias: `db` disuntikkan supaya server action dan skrip
 * uji menjalankan kode yang SAMA (pola `premiumCore.ts`).
 *
 * Fungsi di sini TIDAK memeriksa siapa pemanggilnya - karena itu tidak tinggal di berkas "use server". Pemanggilnya
 * (`syroboActions.ts`) menjamin `uid` berasal dari sesi.
 *
 * Koleksi: `syrobo/{uid}` (satu dokumen per akun; tertutup dari klien oleh rules bawaan).
 * Setiap perubahan = SATU transaksi baca-ubah-tulis, jadi klaim ganda / beli ganda yang bersamaan tak bisa menggandakan poin.
 */
import type { Firestore } from "firebase-admin/firestore";
import {
  HADIAH,
  KOTOR_SAAT_MAKAN,
  MAKANAN_MAKS_STOK,
  GOSOK_MAKS_PER_PANGGILAN,
  UKURAN_MAKS,
  UKURAN_MIN,
  cariPakaian,
  pakaianSah,
  slotSah,
  ukuranSah,
  bisaDiklaim,
  cariMakanan,
  gulirHari,
  kondisiSaatIni,
  makananSah,
  namaSah,
  normalisasi,
  potret,
  suasana,
  terapkanDetak,
  type SlotPakaian,
  type DataSyrobo,
  type MakananId,
  type Suasana,
} from "./syroboRules";

export const SYROBO = "syrobo";

/** Bentuk yang dikirim ke klien: data + kondisi yang sudah dihitung pada `sekarang`. */
export interface TampilanSyrobo extends DataSyrobo {
  kenyangSekarang: number;
  bersihSekarang: number;
  suasana: Suasana;
  /** Menit hadiah yang sudah boleh diklaim saat ini. */
  siapKlaim: number[];
  sekarang: string;
}

export type HasilSyrobo = { ok: true; robot: TampilanSyrobo } | { ok: false; error: string };

export function tampilkan(d: DataSyrobo, now: Date): TampilanSyrobo {
  const k = kondisiSaatIni(d, now);
  return {
    ...d,
    kenyangSekarang: Math.round(k.kenyang),
    bersihSekarang: Math.round(k.bersih),
    suasana: suasana(k),
    siapKlaim: HADIAH.filter((h) => bisaDiklaim(d, h.menit)).map((h) => h.menit),
    sekarang: now.toISOString(),
  };
}

/** Bacaan tanpa tulis (halaman memuat, ekspresi robot asisten). */
export async function bacaSyrobo(db: Firestore, uid: string, now = new Date()): Promise<TampilanSyrobo> {
  const snap = await db.collection(SYROBO).doc(uid).get();
  return tampilkan(gulirHari(normalisasi(snap.exists ? snap.data() : null, now), now), now);
}

type Ubah = (d: DataSyrobo) => DataSyrobo | string;

/** Transaksi baca-ubah-tulis. `ubah` mengembalikan data baru, atau teks galat (tidak menulis apa pun). */
async function ubahSyrobo(db: Firestore, uid: string, now: Date, ubah: Ubah): Promise<HasilSyrobo> {
  const ref = db.collection(SYROBO).doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const awal = gulirHari(normalisasi(snap.exists ? snap.data() : null, now), now);
    const hasil = ubah(awal);
    if (typeof hasil === "string") return { ok: false as const, error: hasil };
    tx.set(ref, hasil);
    return { ok: true as const, robot: tampilkan(hasil, now) };
  });
}

/** Detak waktu aktif (klien mengirim berkala selama tab terlihat). Kenaikan dibatasi di `terapkanDetak`. */
export function detak(db: Firestore, uid: string, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d) => terapkanDetak(d, now));
}

/** Klaim satu hadiah poin (`menit` dari daftar HADIAH). */
export function klaim(db: Firestore, uid: string, menit: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d) => {
    const h = HADIAH.find((x) => x.menit === menit);
    if (!h) return "Hadiah tidak dikenal.";
    if (d.diklaim.includes(h.menit)) return "Hadiah ini sudah kamu klaim hari ini.";
    if (!bisaDiklaim(d, h.menit)) return "Waktunya belum cukup untuk hadiah ini.";
    return { ...d, poin: d.poin + h.poin, diklaim: [...d.diklaim, h.menit] };
  });
}

export function beli(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d) => {
    if (!makananSah(id)) return "Makanan tidak dikenal.";
    const m = cariMakanan(id);
    if (d.poin < m.harga) return "Poinmu belum cukup.";
    if (d.stok[id] >= MAKANAN_MAKS_STOK) return `Stok ${m.nama} sudah penuh.`;
    return { ...d, poin: d.poin - m.harga, stok: { ...d.stok, [id]: d.stok[id] + 1 } };
  });
}

export function beriMakan(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d0) => {
    if (!makananSah(id)) return "Makanan tidak dikenal.";
    const m = cariMakanan(id as MakananId);
    if (d0.stok[id] < 1) return `Kamu tidak punya ${m.nama}. Beli dulu di kotak makanan.`;
    const d = potret(d0, now);
    if (d.kenyang >= 98) return "Robotmu sudah kenyang.";
    return {
      ...d,
      kenyang: Math.min(100, d.kenyang + m.isi),
      bersih: Math.max(0, d.bersih - KOTOR_SAAT_MAKAN),
      stok: { ...d.stok, [id]: d.stok[id] - 1 },
    };
  });
}

export function mandikan(db: Firestore, uid: string, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d0) => {
    const d = potret(d0, now);
    if (d.bersih >= 95) return "Robotmu sudah bersih.";
    return { ...d, bersih: 100 };
  });
}

/** Membeli pakaian di toko: poin berkurang, pakaian masuk daftar milik (tidak bisa dibeli dua kali). */
export function beliPakaian(db: Firestore, uid: string, id: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d) => {
    if (!pakaianSah(id)) return "Pakaian tidak dikenal.";
    const b = cariPakaian(id);
    if (d.punya.includes(id)) return `${b.nama} sudah kamu miliki.`;
    if (d.poin < b.harga) return "Poinmu belum cukup.";
    return { ...d, poin: d.poin - b.harga, punya: [...d.punya, id] };
  });
}

/** Memasang pakaian ke slotnya (id null = melepas). Hanya yang sudah dibeli, dan harus cocok dengan slotnya. */
export function pasangPakaian(db: Firestore, uid: string, slot: unknown, id: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d) => {
    if (!slotSah(slot)) return "Slot pakaian tidak dikenal.";
    if (id === null) return { ...d, [slot]: null };
    if (!pakaianSah(id)) return "Pakaian tidak dikenal.";
    if (cariPakaian(id).slot !== slot) return "Pakaian itu tidak cocok untuk slot ini.";
    if (!d.punya.includes(id)) return "Beli pakaian itu dulu di toko.";
    return { ...d, [slot]: id };
  });
}

/** Ukuran pakaian di satu slot (persen UKURAN_MIN..UKURAN_MAKS, bilangan bulat). */
export function ukuranPakaian(db: Firestore, uid: string, slot: unknown, persen: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d) => {
    if (!slotSah(slot)) return "Slot pakaian tidak dikenal.";
    if (!ukuranSah(persen)) return `Ukuran harus bilangan bulat ${UKURAN_MIN}-${UKURAN_MAKS}%.`;
    return { ...d, ukuran: { ...d.ukuran, [slot as SlotPakaian]: persen } };
  });
}

/**
 * Menggosok dengan spons: menambah kebersihan sebesar `tambah` poin (1..GOSOK_MAKS_PER_PANGGILAN) sampai penuh. Klien menghitung jarak gosokan
 * dan mengirim berkala; server hanya membatasi tiap panggilan dan menjepit di 100.
 */
export function gosok(db: Firestore, uid: string, tambah: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d0) => {
    if (typeof tambah !== "number" || !Number.isFinite(tambah) || tambah <= 0) return "Gosokan tidak sah.";
    const d = potret(d0, now);
    if (d.bersih >= 100) return "Robotmu sudah bersih.";
    return { ...d, bersih: Math.min(100, d.bersih + Math.min(GOSOK_MAKS_PER_PANGGILAN, tambah)) };
  });
}

export function gantiNama(db: Firestore, uid: string, raw: unknown, now = new Date()): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, (d) => {
    const nama = namaSah(raw);
    return nama ? { ...d, nama } : "Nama harus 1-20 karakter.";
  });
}
