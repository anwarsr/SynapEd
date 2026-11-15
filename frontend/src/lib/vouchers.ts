import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getCourse, listCourses, type CourseDetail } from "@/lib/courses";
import { listCategories } from "@/lib/categories";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { isLive, listOrdersOfUser, listOrdersWithVoucher, type Order } from "@/lib/orders";
import { catatPemakaianVoucher, type PemakaianVoucherDoc } from "@/lib/voucherCore";
import {
  VOUCHERS,
  VOUCHER_REDEMPTIONS,
  alasanDitolak,
  hitungHarga,
  kodeSah,
  normalisasiKode,
  parseVoucher,
  type SasaranVoucher,
  type Voucher,
  type VoucherPesanan,
} from "@/lib/voucherRules";

/**
 * Pembaca & penilai voucher di server. Tanpa penjaga peran - dipanggil dari
 * Server Action yang sudah memeriksa sesinya sendiri, dengan uid DARI SESI.
 */

export function voucherRef(code: string) {
  return adminDb().collection(VOUCHERS).doc(code);
}

export async function getVoucher(code: string): Promise<Voucher | null> {
  if (!kodeSah(code)) return null;
  const snap = await voucherRef(code).get();
  return snap.exists ? parseVoucher(snap.data(), snap.id) : null;
}

export async function listVouchers(): Promise<Voucher[]> {
  const snap = await adminDb().collection(VOUCHERS).get();
  return snap.docs.map((d) => parseVoucher(d.data(), d.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listPemakaianVoucher(code: string): Promise<PemakaianVoucherDoc[]> {
  const snap = await adminDb().collection(VOUCHER_REDEMPTIONS).where("code", "==", code).get();
  return snap.docs.map((d) => d.data() as PemakaianVoucherDoc).sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Pilihan cakupan untuk formulir admin: kursus BERBAYAR di katalog publik dan
 * kategori. `jamServer` = satu jam untuk seluruh render halaman.
 */
export async function pilihanVoucher() {
  const [kursus, kategori] = await Promise.all([listCourses(), listCategories()]);
  return {
    kursus: kursus
      .filter((k) => k.price > 0)
      .map((k) => ({ slug: k.slug, title: k.title, price: k.price, category: k.category }))
      .sort((a, b) => a.title.localeCompare(b.title, "id")),
    kategori: kategori.map((k) => ({ slug: k.slug, label: k.label })),
    jamServer: new Date().toISOString(),
  };
}

/** Yang ingin dibeli, dalam bentuk yang dikirim browser: hanya JENIS & slug - harga dibaca di sini. */
export type SasaranMentah = { kind: "premium" } | { kind: "course"; slug: string };

export type SasaranTerbaca =
  | { ok: true; sasaran: SasaranVoucher; course: CourseDetail | null; judul: string }
  | { ok: false; error: string };

export async function bacaSasaran(raw: unknown): Promise<SasaranTerbaca> {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (r.kind === "premium") {
    const s = await getPaymentSettings();
    return { ok: true, sasaran: { kind: "premium", price: s.premiumPrice }, course: null, judul: "SynapEd Premium" };
  }
  if (r.kind === "course" && typeof r.slug === "string" && r.slug) {
    const course = await getCourse(r.slug);
    if (!course) return { ok: false, error: "Kursus tidak ditemukan." };
    if (course.price <= 0) return { ok: false, error: "Kursus ini gratis - tidak perlu voucher." };
    return { ok: true, sasaran: { kind: "course", slug: course.slug, category: course.category ?? "", price: course.price }, course, judul: course.title };
  }
  return { ok: false, error: "Pembelian tidak dikenal." };
}

const sasaranSama = (o: Order, s: SasaranVoucher) =>
  s.kind === "premium" ? o.kind === "premium" : o.kind === "course" && o.courseSlug === s.slug;

export type HasilVoucher =
  | { ok: true; voucher: null; potongan: 0; akhir: number; snapshot: null }
  | { ok: true; voucher: Voucher; potongan: number; akhir: number; snapshot: VoucherPesanan }
  | { ok: false; error: string };

/**
 * Menilai kode voucher untuk satu pembelian akun `uid`. Kode kosong = tanpa
 * voucher (harga normal). Dipanggil SETIAP kali pesanan dibuat - hasil
 * `cekVoucher` di browser hanya pratinjau.
 *
 * Kuota & batas per akun menghitung pemakaian yang LUNAS ditambah pesanan yang
 * masih hidup (menunggu bayar / ditinjau): tanpa itu, voucher sekali pakai bisa
 * dipakai di dua pesanan tertunda sekaligus lalu keduanya dibayar. Pesanan
 * hidup akun ini untuk barang yang SAMA tidak dihitung - ia akan dipakai ulang
 * atau diganti oleh pesanan yang sedang dibuat.
 */
export async function nilaiVoucher(uid: string, kodeRaw: unknown, sasaran: SasaranVoucher, now = new Date()): Promise<HasilVoucher> {
  const code = normalisasiKode(kodeRaw);
  if (code === "") return { ok: true, voucher: null, potongan: 0, akhir: sasaran.price, snapshot: null };

  const voucher = await getVoucher(code);
  if (!voucher) return { ok: false, error: "Kode voucher tidak dikenal." };

  const [pesanan, pemakaian, milikAkun] = await Promise.all([
    listOrdersWithVoucher(code),
    listPemakaianVoucher(code),
    voucher.pembelianPertama ? listOrdersOfUser(uid) : Promise.resolve([] as Order[]),
  ]);
  const hidup = pesanan.filter((o) => isLive(o, now) && !(o.uid === uid && sasaranSama(o, sasaran)));

  const error = alasanDitolak(voucher, {
    now,
    uid,
    sasaran,
    pakaiAkun: pemakaian.filter((p) => p.uid === uid).length + hidup.filter((o) => o.uid === uid).length,
    pakaiTotal: voucher.dipakai + hidup.length,
    pernahBeli: milikAkun.some((o) => o.status === "paid"),
  });
  if (error) return { ok: false, error };

  const { potongan, akhir } = hitungHarga(voucher, sasaran.price);
  return { ok: true, voucher, potongan, akhir, snapshot: { code, original: sasaran.price, discount: potongan } };
}

/**
 * Mencatat pemakaian voucher pesanan yang SUDAH dipastikan lunas oleh
 * pemanggilnya (webhook bertanda tangan, keputusan admin). Idempoten.
 */
export async function catatVoucherPesanan(order: Order, at: string): Promise<boolean> {
  if (!order.voucher) return false;
  return catatPemakaianVoucher(adminDb(), {
    orderId: order.orderId,
    uid: order.uid,
    userName: order.userName,
    kind: order.kind,
    courseSlug: order.courseSlug,
    courseTitle: order.courseTitle,
    voucher: order.voucher,
    method: order.method,
    at,
  });
}
