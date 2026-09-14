import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { parseStoredContributors } from "@/lib/contributors";
import { getUserCards } from "@/lib/userCards";
import { ROYALTY_EARNINGS, ROYALTY_SALES } from "@/lib/royaltyLedgerCore";

/**
 * Data dashboard royalti.
 *
 * Tidak ada DTO di sini yang membawa `orderId` atau ID dokumen buku royalti:
 * ID pesanan memuat enam karakter awal uid pembeli, dan kontributor tidak
 * berhak tahu siapa membeli kursusnya. Buku royaltinya sendiri pun tidak
 * menyimpan identitas pembeli.
 *
 * Seluruh kueri memakai satu field lalu diurutkan di memori — tanpa indeks
 * komposit yang harus di-deploy terpisah.
 */

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

// ── Pendapatan saya ─────────────────────────────────────────────────────

export interface EarningRow {
  saleAt: string;
  courseSlug: string;
  courseTitle: string;
  role: "owner" | "contributor" | "referral";
  sharePercent: number;
  feePercent: number;
  gross: number;
  amount: number;
}

export interface EarningCourse {
  courseSlug: string;
  courseTitle: string;
  total: number;
  sales: number;
}

export interface MyEarnings {
  total: number;
  sales: number;
  /** Bagian dari `total` yang berasal dari kode referral. */
  referralTotal: number;
  referralSales: number;
  courses: EarningCourse[];
  rows: EarningRow[];
}

export async function getMyEarnings(uid: string): Promise<MyEarnings> {
  const snap = await adminDb().collection(ROYALTY_EARNINGS).where("uid", "==", uid).get();

  const rows: EarningRow[] = snap.docs
    .map((d) => {
      const e = d.data();
      return {
        saleAt: str(e.saleAt),
        courseSlug: str(e.courseSlug),
        courseTitle: str(e.courseTitle),
        role: e.role === "owner" ? ("owner" as const) : e.role === "referral" ? ("referral" as const) : ("contributor" as const),
        sharePercent: num(e.sharePercent),
        feePercent: num(e.feePercent),
        gross: num(e.gross),
        amount: num(e.amount),
      };
    })
    .sort((a, b) => b.saleAt.localeCompare(a.saleAt));

  const perKursus = new Map<string, EarningCourse>();
  for (const r of rows) {
    const c = perKursus.get(r.courseSlug) ?? { courseSlug: r.courseSlug, courseTitle: r.courseTitle, total: 0, sales: 0 };
    c.total += r.amount;
    c.sales += 1;
    perKursus.set(r.courseSlug, c);
  }

  return {
    total: rows.reduce((n, r) => n + r.amount, 0),
    sales: rows.length,
    referralTotal: rows.filter((r) => r.role === "referral").reduce((n, r) => n + r.amount, 0),
    referralSales: rows.filter((r) => r.role === "referral").length,
    courses: [...perKursus.values()].sort((a, b) => b.total - a.total),
    rows,
  };
}

// ── Kursus tempat saya berkontribusi ────────────────────────────────────

export interface ContributionRow {
  slug: string;
  title: string;
  /** Persentase SAAT INI — berlaku untuk penjualan berikutnya. */
  share: number;
  role: "owner" | "contributor";
  visibility: "public" | "private";
}

export async function getMyContributions(uid: string): Promise<ContributionRow[]> {
  const snap = await adminDb().collection("courses").where("contributorUids", "array-contains", uid).get();

  const rows: ContributionRow[] = [];
  for (const d of snap.docs) {
    const c = d.data();
    const ownerUid = str(c.ownerUid) || null;
    const list = parseStoredContributors(c.contributors, ownerUid);
    const mine = list?.find((x) => x.uid === uid);
    if (!list || !mine) continue; // data rusak: jangan tampilkan angka yang tidak bisa dipercaya

    rows.push({
      slug: d.id,
      title: str(c.title),
      share: mine.share,
      role: mine.uid === ownerUid ? "owner" : "contributor",
      visibility: c.visibility === "private" ? "private" : "public",
    });
  }

  return rows.sort((a, b) => a.title.localeCompare(b.title, "id"));
}

// ── Penjualan kursus saya (educator/admin) ──────────────────────────────

export interface SaleLineView {
  name: string;
  share: number;
  amount: number;
  isOwner: boolean;
}

export interface SaleRow {
  saleAt: string;
  courseSlug: string;
  courseTitle: string;
  gross: number;
  feePercent: number;
  feeAmount: number;
  ownerAmount: number;
  othersAmount: number;
  unallocatedAmount: number;
  lines: SaleLineView[];
}

export interface MySales {
  gross: number;
  fee: number;
  owner: number;
  others: number;
  unallocated: number;
  rows: SaleRow[];
}

export async function getMySales(uid: string): Promise<MySales> {
  const snap = await adminDb().collection(ROYALTY_SALES).where("ownerUid", "==", uid).get();

  const mentah = snap.docs.map((d) => d.data());
  const uids = mentah.flatMap((s) => (Array.isArray(s.lines) ? s.lines.map((l: { uid?: unknown }) => str(l.uid)) : []));
  const cards = await getUserCards(uids);

  const rows: SaleRow[] = mentah
    .map((s) => {
      const lines = (Array.isArray(s.lines) ? s.lines : []) as { uid?: unknown; share?: unknown; amount?: unknown }[];
      const view = lines.map((l) => ({
        name: str(l.uid) === uid ? "Anda" : (cards.get(str(l.uid))?.name ?? "Akun terhapus"),
        share: num(l.share),
        amount: num(l.amount),
        isOwner: str(l.uid) === uid,
      }));
      return {
        saleAt: str(s.saleAt),
        courseSlug: str(s.courseSlug),
        courseTitle: str(s.courseTitle),
        gross: num(s.gross),
        feePercent: num(s.feePercent),
        feeAmount: num(s.feeAmount),
        ownerAmount: view.filter((l) => l.isOwner).reduce((n, l) => n + l.amount, 0),
        othersAmount: view.filter((l) => !l.isOwner).reduce((n, l) => n + l.amount, 0),
        unallocatedAmount: num(s.unallocatedAmount),
        lines: view,
      };
    })
    .sort((a, b) => b.saleAt.localeCompare(a.saleAt));

  return {
    gross: rows.reduce((n, r) => n + r.gross, 0),
    fee: rows.reduce((n, r) => n + r.feeAmount, 0),
    owner: rows.reduce((n, r) => n + r.ownerAmount, 0),
    others: rows.reduce((n, r) => n + r.othersAmount, 0),
    unallocated: rows.reduce((n, r) => n + r.unallocatedAmount, 0),
    rows,
  };
}

// ── Admin ───────────────────────────────────────────────────────────────

export interface UnallocatedSale {
  /** Admin boleh melihat nomor pesanan — ia yang menindaklanjuti. */
  orderId: string;
  saleAt: string;
  courseSlug: string;
  courseTitle: string;
  gross: number;
  unallocatedAmount: number;
  termsOrigin: string;
}

/** Penjualan yang sebagian uangnya tidak punya penerima. KHUSUS ADMIN. */
export async function listUnallocatedSales(): Promise<UnallocatedSale[]> {
  const snap = await adminDb().collection(ROYALTY_SALES).where("unallocatedAmount", ">", 0).get();
  return snap.docs
    .map((d) => {
      const s = d.data();
      return {
        orderId: d.id,
        saleAt: str(s.saleAt),
        courseSlug: str(s.courseSlug),
        courseTitle: str(s.courseTitle),
        gross: num(s.gross),
        unallocatedAmount: num(s.unallocatedAmount),
        termsOrigin: str(s.termsOrigin),
      };
    })
    .sort((a, b) => b.saleAt.localeCompare(a.saleAt));
}

export interface PostPaidOrder {
  orderId: string;
  courseTitle: string;
  amount: number;
  postPaidStatus: string;
  postPaidTransactionStatus: string;
  postPaidAt: string;
}

/** Pesanan lunas yang kemudian menerima kabar gagal (refund/chargeback). KHUSUS ADMIN. */
export async function listPostPaidOrders(): Promise<PostPaidOrder[]> {
  const snap = await adminDb().collection("orders").where("postPaidStatus", "in", ["failed", "expired"]).get();
  return snap.docs
    .map((d) => {
      const o = d.data();
      return {
        orderId: d.id,
        courseTitle: str(o.courseTitle),
        amount: num(o.amount),
        postPaidStatus: str(o.postPaidStatus),
        postPaidTransactionStatus: str(o.postPaidTransactionStatus),
        postPaidAt: str(o.postPaidAt),
      };
    })
    .sort((a, b) => b.postPaidAt.localeCompare(a.postPaidAt));
}
