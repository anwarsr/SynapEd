/**
 * Pembagian uang satu penjualan.
 *
 * Modul NETRAL tanpa impor alias: dipakai server saat mencatat pendapatan,
 * editor untuk pratinjau, dan skrip backfill. SATU fungsi untuk ketiganya —
 * dua salinan rumus pembagian uang adalah dua sumber kebenaran yang pasti
 * suatu hari menghasilkan angka berbeda untuk penjualan yang sama.
 *
 * Seluruhnya aritmetika bilangan bulat rupiah. Tidak ada pembagian desimal
 * sebelum `Math.floor`, jadi tidak ada galat pembulatan floating-point.
 */
import type { Contributor } from "./contributors";

export interface SplitLine {
  uid: string;
  share: number;
  amount: number;
  role: "owner" | "contributor";
}

export interface SplitResult {
  feeAmount: number;
  /** Bagian bersih yang tidak punya penerima (kursus tanpa pemilik). */
  unallocatedAmount: number;
  lines: SplitLine[];
}

export function splitSale(
  gross: number,
  feePercent: number,
  contributors: readonly Contributor[] | null,
): SplitResult {
  if (!Number.isSafeInteger(gross) || gross < 0) {
    throw new Error(`splitSale: gross tidak sah (${gross}).`);
  }
  if (!Number.isInteger(feePercent) || feePercent < 0 || feePercent > 100) {
    throw new Error(`splitSale: feePercent tidak sah (${feePercent}).`);
  }

  // Dibulatkan KE BAWAH: sisa pembulatan jatuh ke kontributor, bukan platform.
  const feeAmount = Math.floor((gross * feePercent) / 100);
  const net = gross - feeAmount;

  if (!contributors || contributors.length === 0) {
    return { feeAmount, unallocatedAmount: net, lines: [] };
  }

  const total = contributors.reduce((n, c) => n + c.share, 0);
  if (total !== 100) throw new Error(`splitSale: total share ${total}, bukan 100.`);

  const uids = new Set(contributors.map((c) => c.uid));
  if (uids.size !== contributors.length) throw new Error("splitSale: uid kontributor ganda.");

  // Metode sisa terbesar (largest remainder / Hamilton).
  //
  // Setiap orang mendapat bagian bulat ke bawah dulu, lalu rupiah yang
  // tersisa dibagikan satu per satu kepada pecahan terbesar. Membulatkan
  // tiap bagian sendiri-sendiri (Math.round) bisa menghasilkan total 99 atau
  // 101 — uang yang tercipta atau hilang dari satu penjualan.
  const baris = contributors.map((c, i) => {
    const mentah = net * c.share;
    return {
      i,
      uid: c.uid,
      share: c.share,
      base: Math.floor(mentah / 100),
      sisa: mentah % 100,
    };
  });

  let leftover = net - baris.reduce((n, b) => n + b.base, 0);

  // Sisa terbesar didahulukan; kalau seri, urutan daftar — dan pemilik
  // selalu di posisi pertama.
  const urut = [...baris].sort((a, b) => b.sisa - a.sisa || a.i - b.i);
  const tambahan = new Map<number, number>();
  for (const b of urut) {
    if (leftover <= 0) break;
    tambahan.set(b.i, 1);
    leftover--;
  }

  const lines: SplitLine[] = baris.map((b) => ({
    uid: b.uid,
    share: b.share,
    amount: b.base + (tambahan.get(b.i) ?? 0),
    role: b.i === 0 ? "owner" : "contributor",
  }));

  const jumlah = feeAmount + lines.reduce((n, l) => n + l.amount, 0);
  if (jumlah !== gross) {
    throw new Error(`splitSale: invarian gagal, ${jumlah} != ${gross}.`);
  }

  return { feeAmount, unallocatedAmount: 0, lines };
}

/**
 * Bagian perujuk dari satu penjualan — DIAMBIL DARI potongan platform, bukan
 * dari bagian kontributor.
 *
 * Dihitung dari harga kotor lalu dibulatkan ke bawah. Karena persentase
 * referral tidak pernah melebihi persentase potongan, `floor(g×r/100)` tidak
 * pernah melebihi `floor(g×f/100)`; pemeriksaan di bawah tetap ada supaya
 * data rusak ditolak, bukan membuat bagian platform menjadi negatif.
 */
export function referralAmountOf(gross: number, feeAmount: number, referralPercent: number): number {
  if (!Number.isSafeInteger(gross) || gross < 0) {
    throw new Error(`referralAmountOf: gross tidak sah (${gross}).`);
  }
  if (!Number.isInteger(referralPercent) || referralPercent < 0 || referralPercent > 100) {
    throw new Error(`referralAmountOf: persentase tidak sah (${referralPercent}).`);
  }

  const amount = Math.floor((gross * referralPercent) / 100);
  if (amount > feeAmount) {
    throw new Error(`referralAmountOf: bagian referral ${amount} melebihi potongan platform ${feeAmount}.`);
  }
  return amount;
}
