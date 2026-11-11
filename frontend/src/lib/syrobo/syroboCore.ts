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
  CHEAT_MENIT,
  CHEAT_POIN,
  KODE_CHEAT,
  KODE_CHEAT_DEWA,
  MAKANAN_DEWA,
  sisaEmasMs,
  tanggalWib,
  HADIAH,
  poinHadiah,
  JAM_BEKU_DEWA,
  KOIN_HARIAN_MAKS,
  KOIN_PER_POIN,
  KOIN_SETOR_MAKS,
  KOTOR_SAAT_MAKAN,
  PAKAIAN,
  PAKAIAN_PREMIUM,
  makananDewaSah,
  sisaBekuMs,
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
  energiSaatIni,
  potretEnergi,
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

const PESAN_TIDUR = (nama: string) => `${nama} sedang tidur. Nyalakan lampu di Main Room untuk membangunkannya.`;

/** Bentuk yang dikirim ke klien: data + kondisi yang sudah dihitung pada `sekarang`. */
export interface TampilanSyrobo extends DataSyrobo {
  /** SynapEd Premium aktif saat ini (dari server): membuka pakaian & makanan dewa premium. */
  premium: boolean;
  kenyangSekarang: number;
  bersihSekarang: number;
  suasana: Suasana;
  /** Energi saat ini (0..100); `tidur` = lampu Main Room padam (robot sedang tidur). */
  energiSekarang: number;
  tidur: boolean;
  /** Menit hadiah yang sudah boleh diklaim saat ini. */
  siapKlaim: number[];
  /** Robot sedang EMAS (cheat) dan sisa waktunya (ms). */
  emas: boolean;
  emasSisaMs: number;
  sekarang: string;
}

export type HasilSyrobo = { ok: true; robot: TampilanSyrobo } | { ok: false; error: string };

export function tampilkan(d: DataSyrobo, now: Date, premium = false): TampilanSyrobo {
  const k = kondisiSaatIni(d, now);
  const sembunyi = (id: DataSyrobo["kepala"]) => (id && PAKAIAN.find((p) => p.id === id)?.premium && !premium ? null : id);
  return {
    ...d,
    premium,
    // Premium berakhir: pakaian premium yang sedang dipakai disembunyikan (tak dihapus dari data; kembali bila premium aktif lagi).
    kepala: sembunyi(d.kepala),
    badan: sembunyi(d.badan),
    // Pakaian premium terbuka SELAMA premium aktif (tak pernah disimpan di `punya`).
    punya: premium ? [...d.punya, ...PAKAIAN_PREMIUM.filter((x) => !d.punya.includes(x))] : d.punya,
    bekuLaparSampai: sisaBekuMs(d, now) > 0 ? d.bekuLaparSampai : null,
    // Aura makanan dewa hanya menyala selama bar kenyang masih beku.
    dewaId: sisaBekuMs(d, now) > 0 ? d.dewaId : null,
    emas: sisaEmasMs(d, now) > 0,
    emasSisaMs: sisaEmasMs(d, now),
    kenyangSekarang: Math.round(k.kenyang),
    bersihSekarang: Math.round(k.bersih),
    suasana: suasana(k),
    energiSekarang: Math.round(energiSaatIni(d, now)),
    tidur: d.tidurSejak !== null,
    siapKlaim: HADIAH.filter((h) => bisaDiklaim(d, h.menit)).map((h) => h.menit),
    sekarang: now.toISOString(),
  };
}

/** Bacaan tanpa tulis (halaman memuat, ekspresi robot asisten). */
export async function bacaSyrobo(db: Firestore, uid: string, now = new Date(), premium = false): Promise<TampilanSyrobo> {
  const snap = await db.collection(SYROBO).doc(uid).get();
  return tampilkan(gulirHari(normalisasi(snap.exists ? snap.data() : null, now), now), now, premium);
}

type Ubah = (d: DataSyrobo) => DataSyrobo | string;

/** Transaksi baca-ubah-tulis. `ubah` mengembalikan data baru, atau teks galat (tidak menulis apa pun). */
async function ubahSyrobo(db: Firestore, uid: string, now: Date, premium: boolean, ubah: Ubah): Promise<HasilSyrobo> {
  const ref = db.collection(SYROBO).doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const awal = gulirHari(normalisasi(snap.exists ? snap.data() : null, now), now);
    const hasil = ubah(awal);
    if (typeof hasil === "string") return { ok: false as const, error: hasil };
    tx.set(ref, hasil);
    return { ok: true as const, robot: tampilkan(hasil, now, premium) };
  });
}

/** Detak waktu aktif (klien mengirim berkala selama tab terlihat). Kenaikan dibatasi di `terapkanDetak`. */
export function detak(db: Firestore, uid: string, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => terapkanDetak(d, now));
}

/** Klaim satu hadiah poin (`menit` dari daftar HADIAH). */
export function klaim(db: Firestore, uid: string, menit: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    const h = HADIAH.find((x) => x.menit === menit);
    if (!h) return "Hadiah tidak dikenal.";
    if (d.diklaim.includes(h.menit)) return "Hadiah ini sudah kamu klaim hari ini.";
    if (!bisaDiklaim(d, h.menit)) return "Waktunya belum cukup untuk hadiah ini.";
    return { ...d, poin: d.poin + poinHadiah(h.poin, premium), diklaim: [...d.diklaim, h.menit] };
  });
}

export function beli(db: Firestore, uid: string, id: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    if (!makananSah(id)) return "Makanan tidak dikenal.";
    const m = cariMakanan(id);
    if (d.poin < m.harga) return "Poinmu belum cukup.";
    if (d.stok[id] >= MAKANAN_MAKS_STOK) return `Stok ${m.nama} sudah penuh.`;
    return { ...d, poin: d.poin - m.harga, stok: { ...d.stok, [id]: d.stok[id] + 1 } };
  });
}

export function beriMakan(db: Firestore, uid: string, id: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d0) => {
    if (!makananSah(id)) return "Makanan tidak dikenal.";
    const m = cariMakanan(id as MakananId);
    if (d0.tidurSejak) return PESAN_TIDUR(d0.nama);
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

/**
 * Makanan DEWA (khusus premium aktif, gratis, tanpa stok): mengenyangkan penuh dan membekukan bar kenyang `JAM_BEKU_DEWA` jam.
 * Selama masih beku makanan dewa lain ditolak. Premium dicek ULANG di server (`premium` berasal dari keanggotaan, bukan kiriman).
 */
export function beriMakanDewa(db: Firestore, uid: string, id: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d0) => {
    if (!makananDewaSah(id)) return "Makanan dewa tidak dikenal.";
    if (d0.tidurSejak) return PESAN_TIDUR(d0.nama);
    // Premium aktif makan gratis tanpa stok; selain itu harus punya stoknya (dari cheat).
    if (!premium && d0.stokDewa[id] < 1) return "Makanan dewa khusus pemilik SynapEd Premium aktif (atau yang punya stoknya).";
    const sisa = sisaBekuMs(d0, now);
    if (sisa > 0) return `${d0.nama} masih kenyang oleh makanan dewa (sisa ${Math.ceil(sisa / 3600_000)} jam).`;
    const d = potret(d0, now);
    return {
      ...d,
      kenyang: 100,
      bersih: Math.max(0, d.bersih - KOTOR_SAAT_MAKAN),
      bekuLaparSampai: new Date(now.getTime() + JAM_BEKU_DEWA * 3600_000).toISOString(),
      dewaId: id,
      stokDewa: premium ? d.stokDewa : { ...d.stokDewa, [id]: d.stokDewa[id] - 1 },
    };
  });
}

/**
 * Menyetor koin hasil main game ke saldo. Angka dari browser: harus bilangan bulat 1..KOIN_SETOR_MAKS dan dipotong ke sisa jatah
 * harian (KOIN_HARIAN_MAKS), jadi memanggil action berulang tak bisa menggandakan lebih dari batas harian.
 */
export function simpanKoinGame(db: Firestore, uid: string, n: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > KOIN_SETOR_MAKS) return `Jumlah koin harus bilangan bulat 1-${KOIN_SETOR_MAKS}.`;
    const sisa = KOIN_HARIAN_MAKS - d.koinSetorHari;
    if (sisa <= 0) return "Batas koin game hari ini sudah tercapai. Coba lagi besok (WIB).";
    const tambah = Math.min(n, sisa);
    return { ...d, koinGame: d.koinGame + tambah, koinSetorHari: d.koinSetorHari + tambah };
  });
}

/** Menukar koin game: tiap KOIN_PER_POIN koin menjadi 1 poin bintang (semua kelipatan penuh sekaligus). */
export function tukarKoinGame(db: Firestore, uid: string, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    const poin = Math.floor(d.koinGame / KOIN_PER_POIN);
    if (poin < 1) return `Koinmu belum cukup: minimal ${KOIN_PER_POIN} koin untuk 1 poin.`;
    return { ...d, poin: d.poin + poin, koinGame: d.koinGame - poin * KOIN_PER_POIN };
  });
}

/**
 * Tidur = lampu Main Room dipadamkan: energi dipotret lalu mulai PULIH. Idempoten (sudah tidur = tak berubah). Tidak memberi poin atau barang,
 * jadi tak ada yang perlu dipercaya dari klien selain "tidur/bangun".
 */
export function tidurkan(db: Firestore, uid: string, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d0) => {
    if (d0.tidurSejak) return d0;
    return { ...potretEnergi(d0, now), tidurSejak: now.toISOString() };
  });
}

/** Bangun = lampu dinyalakan: energi hasil tidur dipotret, lalu kembali turun pelan-pelan. Idempoten. */
export function bangunkan(db: Firestore, uid: string, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d0) => {
    if (!d0.tidurSejak) return d0;
    return { ...potretEnergi(d0, now), tidurSejak: null };
  });
}

/**
 * EASTER EGG: kode cheat. Server membandingkan ulang kode, menjatah SEKALI per hari WIB, lalu memberi poin dan membuat robot emas
 * `CHEAT_MENIT` menit. Mengaktifkan lagi di hari yang sama ditolak tanpa mengubah apa pun.
 */
export function aktifkanCheat(db: Firestore, uid: string, kode: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    const k = typeof kode === "string" ? kode.trim().toUpperCase() : "";
    if (k === KODE_CHEAT_DEWA) {
      if (d.cheatDewa) return "Cheat ini hanya bisa dipakai satu kali per akun.";
      const stokDewa = { ...d.stokDewa };
      for (const m of MAKANAN_DEWA) stokDewa[m.id] = Math.min(MAKANAN_MAKS_STOK, stokDewa[m.id] + 1);
      return { ...d, stokDewa, cheatDewa: true };
    }
    if (k !== KODE_CHEAT) return "Kode tidak dikenal.";
    const hari = tanggalWib(now);
    if (d.cheatHari === hari) return "Cheat sudah dipakai hari ini. Coba lagi besok.";
    return { ...d, poin: d.poin + CHEAT_POIN, cheatHari: hari, emasSampai: new Date(now.getTime() + CHEAT_MENIT * 60_000).toISOString() };
  });
}

export function mandikan(db: Firestore, uid: string, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d0) => {
    if (d0.tidurSejak) return PESAN_TIDUR(d0.nama);
    const d = potret(d0, now);
    if (d.bersih >= 95) return "Robotmu sudah bersih.";
    return { ...d, bersih: 100 };
  });
}

/** Membeli pakaian di toko: poin berkurang, pakaian masuk daftar milik (tidak bisa dibeli dua kali). */
export function beliPakaian(db: Firestore, uid: string, id: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    if (!pakaianSah(id)) return "Pakaian tidak dikenal.";
    const b = cariPakaian(id);
    if (b.premium) return `${b.nama} tidak dijual: terbuka gratis selama SynapEd Premium aktif.`;
    if (d.punya.includes(id)) return `${b.nama} sudah kamu miliki.`;
    if (d.poin < b.harga) return "Poinmu belum cukup.";
    return { ...d, poin: d.poin - b.harga, punya: [...d.punya, id] };
  });
}

/** Memasang pakaian ke slotnya (id null = melepas). Hanya yang sudah dibeli, dan harus cocok dengan slotnya. */
export function pasangPakaian(db: Firestore, uid: string, slot: unknown, id: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    if (!slotSah(slot)) return "Slot pakaian tidak dikenal.";
    if (id === null) return { ...d, [slot]: null };
    if (!pakaianSah(id)) return "Pakaian tidak dikenal.";
    if (cariPakaian(id).slot !== slot) return "Pakaian itu tidak cocok untuk slot ini.";
    if (cariPakaian(id).premium) {
      if (!premium) return "Pakaian ini khusus pemilik SynapEd Premium aktif.";
    } else if (!d.punya.includes(id)) return "Beli pakaian itu dulu di toko.";
    return { ...d, [slot]: id };
  });
}

/** Ukuran pakaian di satu slot (persen UKURAN_MIN..UKURAN_MAKS, bilangan bulat). */
export function ukuranPakaian(db: Firestore, uid: string, slot: unknown, persen: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    if (!slotSah(slot)) return "Slot pakaian tidak dikenal.";
    if (!ukuranSah(persen)) return `Ukuran harus bilangan bulat ${UKURAN_MIN}-${UKURAN_MAKS}%.`;
    return { ...d, ukuran: { ...d.ukuran, [slot as SlotPakaian]: persen } };
  });
}

/**
 * Menggosok dengan spons: menambah kebersihan sebesar `tambah` poin (1..GOSOK_MAKS_PER_PANGGILAN) sampai penuh. Klien menghitung jarak gosokan
 * dan mengirim berkala; server hanya membatasi tiap panggilan dan menjepit di 100.
 */
export function gosok(db: Firestore, uid: string, tambah: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d0) => {
    if (typeof tambah !== "number" || !Number.isFinite(tambah) || tambah <= 0) return "Gosokan tidak sah.";
    if (d0.tidurSejak) return PESAN_TIDUR(d0.nama);
    const d = potret(d0, now);
    if (d.bersih >= 100) return "Robotmu sudah bersih.";
    return { ...d, bersih: Math.min(100, d.bersih + Math.min(GOSOK_MAKS_PER_PANGGILAN, tambah)) };
  });
}

export function gantiNama(db: Firestore, uid: string, raw: unknown, now = new Date(), premium = false): Promise<HasilSyrobo> {
  return ubahSyrobo(db, uid, now, premium, (d) => {
    const nama = namaSah(raw);
    return nama ? { ...d, nama } : "Nama harus 1-20 karakter.";
  });
}
