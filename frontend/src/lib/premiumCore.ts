/**
 * Penulis data SynapEd Premium: memberi periode, mencabut, mencatat pemakaian,
 * dan membagi hasil.
 *
 * Tanpa `server-only` dan tanpa impor alias: `db` disuntikkan, supaya skrip
 * `settle-premium` dan verifikasi menjalankan kode yang SAMA PERSIS dengan
 * webhook dan panel admin (pola `royaltyLedgerCore.ts`).
 *
 * Fungsi di sini TIDAK MEMERIKSA SIAPA PEMANGGILNYA - karena itu tidak tinggal
 * di berkas "use server". Pemanggilnya (webhook bertanda tangan, keputusan
 * admin, action yang memeriksa sesi) yang menjamin pemanggilan itu sah.
 *
 * Koleksi baru (semuanya tertutup dari klien oleh rules tanpa perubahan):
 *   premiumMembers/{uid}        { uid, activeUntil, updatedAt }
 *   premiumPeriods/{periodId}   satu periode (periodId = orderId untuk pembelian)
 *   premiumUsage/{periodId}_{slug}   pelajaran yang diselesaikan per kursus
 *   premiumSettlements/{periodId}    hasil pembagian, tepat sekali
 */
import type { Firestore } from "firebase-admin/firestore";
import { ROYALTY_EARNINGS, type RoyaltyEarningDoc } from "./royaltyLedgerCore";
import { referralAmountOf } from "./royaltySplit";
import type { Contributor } from "./contributors";
import {
  PREMIUM_HARI,
  PREMIUM_JUDUL,
  PREMIUM_SLUG,
  parsePremiumTerms,
  perpanjang,
  premiumAktif,
  rencanakanPembagian,
  type PemakaianKursus,
  type RencanaPembagianPremium,
} from "./premiumRules";

export const PREMIUM_MEMBERS = "premiumMembers";
export const PREMIUM_PERIODS = "premiumPeriods";
export const PREMIUM_USAGE = "premiumUsage";
export const PREMIUM_SETTLEMENTS = "premiumSettlements";

export type SumberPremium = "midtrans" | "manual" | "admin";

export interface PremiumPeriodDoc {
  periodId: string;
  uid: string;
  start: string;
  end: string;
  source: SumberPremium;
  orderId: string | null;
  /** Rupiah yang dibayar; 0 untuk pemberian admin (tidak ada yang dibagi). */
  gross: number;
  /** Syarat dibekukan saat pesanan dibuat (`PremiumTerms`), mentah. null untuk pemberian admin. */
  terms: unknown;
  grantedByUid: string | null;
  note: string;
  createdAt: string;
  settledAt: string | null;
  revokedAt: string | null;
  revokedByUid: string | null;
}

export interface PremiumUsageDoc extends PemakaianKursus {
  periodId: string;
  uid: string;
  firstAt: string;
  updatedAt: string;
}

function toPeriod(d: FirebaseFirestore.DocumentData): PremiumPeriodDoc {
  return {
    periodId: String(d.periodId ?? ""),
    uid: String(d.uid ?? ""),
    start: String(d.start ?? ""),
    end: String(d.end ?? ""),
    source: d.source === "manual" || d.source === "admin" ? d.source : "midtrans",
    orderId: typeof d.orderId === "string" ? d.orderId : null,
    gross: typeof d.gross === "number" ? d.gross : 0,
    terms: d.terms ?? null,
    grantedByUid: typeof d.grantedByUid === "string" ? d.grantedByUid : null,
    note: typeof d.note === "string" ? d.note : "",
    createdAt: String(d.createdAt ?? ""),
    settledAt: typeof d.settledAt === "string" ? d.settledAt : null,
    revokedAt: typeof d.revokedAt === "string" ? d.revokedAt : null,
    revokedByUid: typeof d.revokedByUid === "string" ? d.revokedByUid : null,
  };
}

export async function bacaKeanggotaan(db: Firestore, uid: string): Promise<{ activeUntil: string | null }> {
  const d = (await db.collection(PREMIUM_MEMBERS).doc(uid).get()).data();
  return { activeUntil: typeof d?.activeUntil === "string" ? d.activeUntil : null };
}

export async function periodeMilik(db: Firestore, uid: string): Promise<PremiumPeriodDoc[]> {
  const snap = await db.collection(PREMIUM_PERIODS).where("uid", "==", uid).get();
  return snap.docs.map((d) => toPeriod(d.data())).sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Menyamakan `expiresAt` SEMUA pendaftaran `source: "premium"` milik pengguna
 * dengan masa aktif premiumnya. Dengan begitu `isActive(enrollment)` - yang
 * sudah dipakai halaman belajar, tandai selesai, kuis, dan sertifikat -
 * otomatis mengunci saat premium berakhir, tanpa pemeriksaan baru di setiap
 * tempat; kemajuan tetap di dokumennya.
 *
 * Kueri satu field (`uid`) lalu disaring di memori: tanpa indeks komposit.
 */
export async function samakanPendaftaranPremium(db: Firestore, uid: string, expiresAt: string): Promise<number> {
  const snap = await db.collection("enrollments").where("uid", "==", uid).get();
  const premium = snap.docs.filter((d) => d.data().source === "premium");
  if (premium.length === 0) return 0;
  const batch = db.batch();
  for (const d of premium) batch.update(d.ref, { expiresAt });
  await batch.commit();
  return premium.length;
}

export interface BeriPeriodeInput {
  uid: string;
  periodId: string;
  source: SumberPremium;
  gross: number;
  terms: unknown;
  orderId: string | null;
  grantedByUid: string | null;
  note: string;
  hari?: number;
  now: Date;
}

/**
 * Memberi satu periode premium - TEPAT SEKALI per `periodId`, berapa kali pun
 * dipanggil (retry webhook Midtrans, setujui ganda admin).
 *
 * Satu transaksi: periode, masa aktif anggota, dan bagian perujuk (dibayar
 * saat itu juga, diambil dari potongan platform - sama seperti penjualan
 * kursus). Bagian educator BELUM ditulis: itu ditentukan pemakaian dan baru
 * dihitung `bagiHasilPeriode` sesudah periodenya berakhir.
 */
export async function beriPeriodePremium(db: Firestore, input: BeriPeriodeInput): Promise<{ created: boolean; activeUntil: string }> {
  const periodRef = db.collection(PREMIUM_PERIODS).doc(input.periodId);
  const memberRef = db.collection(PREMIUM_MEMBERS).doc(input.uid);
  const nowIso = input.now.toISOString();

  // Bagian perujuk dihitung DI LUAR transaksi: kalau syaratnya rusak, tidak ada yang sempat ditulis.
  const terms = parsePremiumTerms(input.terms);
  let rujukan: { uid: string; percent: number; amount: number; feePercent: number } | null = null;
  if (terms?.referral && input.gross > 0) {
    const fee = Math.floor((input.gross * terms.feePercent) / 100);
    const amount = referralAmountOf(input.gross, fee, terms.referral.percent);
    if (amount > 0) rujukan = { uid: terms.referral.uid, percent: terms.referral.percent, amount, feePercent: terms.feePercent };
  }

  let hasil: { created: boolean; activeUntil: string };
  try {
    hasil = await db.runTransaction(async (tx) => {
      const [ada, anggota] = await Promise.all([tx.get(periodRef), tx.get(memberRef)]);
      const activeUntil = typeof anggota.data()?.activeUntil === "string" ? (anggota.data()!.activeUntil as string) : null;
      if (ada.exists) return { created: false, activeUntil: activeUntil ?? toPeriod(ada.data()!).end };

      const { start, end } = perpanjang(activeUntil, input.now, input.hari ?? PREMIUM_HARI);
      const doc: PremiumPeriodDoc = {
        periodId: input.periodId,
        uid: input.uid,
        start,
        end,
        source: input.source,
        orderId: input.orderId,
        gross: input.gross,
        terms: input.terms ?? null,
        grantedByUid: input.grantedByUid,
        note: input.note,
        createdAt: nowIso,
        settledAt: null,
        revokedAt: null,
        revokedByUid: null,
      };
      tx.create(periodRef, doc);
      tx.set(memberRef, { uid: input.uid, activeUntil: end, updatedAt: nowIso }, { merge: true });
      if (rujukan) {
        const earning: RoyaltyEarningDoc = {
          uid: rujukan.uid,
          courseSlug: PREMIUM_SLUG,
          courseTitle: PREMIUM_JUDUL,
          role: "referral",
          sharePercent: rujukan.percent,
          feePercent: rujukan.feePercent,
          gross: input.gross,
          amount: rujukan.amount,
          saleAt: nowIso,
          source: "premium",
        };
        tx.create(db.collection(ROYALTY_EARNINGS).doc(`${input.periodId}_referral`), earning);
      }
      return { created: true, activeUntil: end };
    });
  } catch (err) {
    // ALREADY_EXISTS: pemanggil lain mengomit periode yang sama di antara baca & komit.
    if ((err as { code?: unknown }).code !== 6) throw err;
    hasil = { created: false, activeUntil: (await bacaKeanggotaan(db, input.uid)).activeUntil ?? input.now.toISOString() };
  }

  await samakanPendaftaranPremium(db, input.uid, hasil.activeUntil);
  return hasil;
}

/**
 * Mencabut premium SEKARANG (pengembalian dana, penyalahgunaan): masa aktif
 * berakhir, periode yang sedang berjalan dipotong di detik ini (pemakaiannya
 * tetap dihitung saat dibagi), periode yang belum mulai dipotong jadi nol.
 * Pendaftaran premium ikut berakhir; kemajuannya tetap tersimpan.
 */
export async function cabutPremium(db: Firestore, input: { uid: string; now: Date; byUid: string; note: string }): Promise<boolean> {
  const nowIso = input.now.toISOString();
  const memberRef = db.collection(PREMIUM_MEMBERS).doc(input.uid);
  const periodeQ = db.collection(PREMIUM_PERIODS).where("uid", "==", input.uid);

  const dicabut = await db.runTransaction(async (tx) => {
    const [anggota, periode] = await Promise.all([tx.get(memberRef), tx.get(periodeQ)]);
    const activeUntil = typeof anggota.data()?.activeUntil === "string" ? (anggota.data()!.activeUntil as string) : null;
    if (!premiumAktif(activeUntil, input.now)) return false;
    for (const d of periode.docs) {
      const p = toPeriod(d.data());
      if (p.end <= nowIso) continue;
      tx.update(d.ref, { end: p.start > nowIso ? p.start : nowIso, revokedAt: nowIso, revokedByUid: input.byUid, revokeNote: input.note });
    }
    tx.set(memberRef, { uid: input.uid, activeUntil: nowIso, updatedAt: nowIso }, { merge: true });
    return true;
  });

  if (dicabut) await samakanPendaftaranPremium(db, input.uid, nowIso);
  return dicabut;
}

/**
 * Mencatat satu pelajaran berbayar yang BARU diselesaikan lewat premium ke
 * periode yang sedang berjalan. Pemilik & kontributor kursus DIBEKUKAN pada
 * pemakaian pertama di periode itu - perubahan pembagian sesudahnya hanya
 * berlaku untuk periode berikutnya (sama dengan syarat yang dibekukan di pesanan).
 *
 * @returns periodId yang ditambah, atau null bila tidak ada periode berjalan.
 */
export async function catatPemakaian(
  db: Firestore,
  input: { uid: string; now: Date; course: { slug: string; title: string; ownerUid: string | null; contributors: readonly Contributor[] } },
): Promise<string | null> {
  const nowIso = input.now.toISOString();
  const berjalan = (await periodeMilik(db, input.uid)).find((p) => p.start <= nowIso && nowIso < p.end);
  if (!berjalan) return null;

  const ref = db.collection(PREMIUM_USAGE).doc(`${berjalan.periodId}_${input.course.slug}`);
  await db.runTransaction(async (tx) => {
    const ada = await tx.get(ref);
    if (ada.exists) {
      tx.update(ref, { lessons: (Number(ada.data()?.lessons) || 0) + 1, updatedAt: nowIso });
      return;
    }
    const doc: PremiumUsageDoc = {
      periodId: berjalan.periodId,
      uid: input.uid,
      courseSlug: input.course.slug,
      courseTitle: input.course.title,
      lessons: 1,
      ownerUid: input.course.ownerUid,
      contributors: input.course.ownerUid ? input.course.contributors.map((c) => ({ uid: c.uid, share: c.share })) : [],
      firstAt: nowIso,
      updatedAt: nowIso,
    };
    tx.create(ref, doc);
  });
  return berjalan.periodId;
}

export type HasilBagi = "dibagi" | "sudah" | "belum-berakhir" | "tidak-ada";

/**
 * Membagi hasil satu periode yang SUDAH BERAKHIR - tepat sekali.
 *
 * Rencananya dihitung murni di luar transaksi (`rencanakanPembagian`); lalu
 * satu transaksi get-then-create menulis ringkasan pembagian, pendapatan tiap
 * pemilik/kontributor (`royaltyEarnings/{periodId}_{slug}_{uid}`, `source:
 * "premium"`, jadi langsung tampil di halaman Pendapatan), dan `settledAt`.
 */
export async function bagiHasilPeriode(db: Firestore, periodId: string, now: Date): Promise<{ hasil: HasilBagi; rencana?: RencanaPembagianPremium }> {
  const periodRef = db.collection(PREMIUM_PERIODS).doc(periodId);
  const snap = await periodRef.get();
  if (!snap.exists) return { hasil: "tidak-ada" };
  const p = toPeriod(snap.data()!);
  if (p.settledAt) return { hasil: "sudah" };
  if (p.end > now.toISOString()) return { hasil: "belum-berakhir" };

  const usageSnap = await db.collection(PREMIUM_USAGE).where("periodId", "==", periodId).get();
  const pemakaian: PemakaianKursus[] = usageSnap.docs.map((d) => {
    const u = d.data();
    return {
      courseSlug: String(u.courseSlug ?? ""),
      courseTitle: String(u.courseTitle ?? ""),
      lessons: Number.isSafeInteger(u.lessons) ? (u.lessons as number) : 0,
      ownerUid: typeof u.ownerUid === "string" ? u.ownerUid : null,
      contributors: Array.isArray(u.contributors) ? (u.contributors as Contributor[]) : [],
    };
  });

  // Pemberian admin (gross 0) tetap "dibagi" dengan semua angka nol, supaya tidak
  // terus muncul di daftar menunggu.
  const rencana = rencanakanPembagian(p.gross, p.gross > 0 ? p.terms : { feePercent: 0, referral: null }, pemakaian);
  const settlementRef = db.collection(PREMIUM_SETTLEMENTS).doc(periodId);
  const nowIso = now.toISOString();

  try {
    const baru = await db.runTransaction(async (tx) => {
      if ((await tx.get(settlementRef)).exists) return false;
      tx.create(settlementRef, {
        periodId,
        uid: p.uid,
        start: p.start,
        end: p.end,
        source: p.source,
        ...rencana,
        settledAt: nowIso,
      });
      for (const l of rencana.lines) {
        const earning: RoyaltyEarningDoc = {
          uid: l.uid,
          courseSlug: l.courseSlug,
          courseTitle: l.courseTitle,
          role: l.role,
          sharePercent: l.sharePercent,
          feePercent: rencana.feePercent,
          gross: l.courseAmount,
          amount: l.amount,
          saleAt: p.end,
          source: "premium",
        };
        tx.create(db.collection(ROYALTY_EARNINGS).doc(`${periodId}_${l.courseSlug}_${l.uid}`), earning);
      }
      tx.update(periodRef, { settledAt: nowIso });
      return true;
    });
    return { hasil: baru ? "dibagi" : "sudah", rencana };
  } catch (err) {
    if ((err as { code?: unknown }).code === 6) return { hasil: "sudah" };
    throw err;
  }
}

/** Periode yang sudah berakhir tetapi belum dibagi. `settledAt` selalu ditulis (null), jadi kueri kesamaan aman. */
export async function periodeSiapDibagi(db: Firestore, now: Date): Promise<PremiumPeriodDoc[]> {
  const snap = await db.collection(PREMIUM_PERIODS).where("settledAt", "==", null).get();
  const nowIso = now.toISOString();
  return snap.docs
    .map((d) => toPeriod(d.data()))
    .filter((p) => p.end <= nowIso)
    .sort((a, b) => a.end.localeCompare(b.end));
}

/** Membagi semua periode yang siap. Satu periode gagal tidak menghentikan yang lain. */
export async function bagiSemuaPeriode(db: Firestore, now: Date): Promise<{ dibagi: number; gagal: { periodId: string; pesan: string }[] }> {
  let dibagi = 0;
  const gagal: { periodId: string; pesan: string }[] = [];
  for (const p of await periodeSiapDibagi(db, now)) {
    try {
      if ((await bagiHasilPeriode(db, p.periodId, now)).hasil === "dibagi") dibagi++;
    } catch (err) {
      gagal.push({ periodId: p.periodId, pesan: err instanceof Error ? err.message : String(err) });
    }
  }
  return { dibagi, gagal };
}
