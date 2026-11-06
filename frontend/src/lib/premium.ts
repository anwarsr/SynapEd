import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { CourseDetail } from "@/lib/courses";
import {
  PREMIUM_MEMBERS,
  PREMIUM_SETTLEMENTS,
  bacaKeanggotaan,
  catatPemakaian,
  periodeMilik,
  periodeSiapDibagi,
  type PremiumPeriodDoc,
} from "@/lib/premiumCore";
import { getCurrentUser } from "@/lib/firebase/session";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { premiumAktif, ringkasPenawaran, sisaHari } from "@/lib/premiumRules";

/**
 * Pembaca SynapEd Premium untuk Server Component & Server Action.
 *
 * Tulisan ada di `premiumCore.ts` (db disuntik). Berkas ini `server-only`, jadi
 * aman diimpor halaman server tanpa menyeret firebase-admin ke bundel browser,
 * dan BUKAN berkas "use server" - tidak ada ekspor yang menjadi endpoint publik.
 */

export interface StatusPremium {
  activeUntil: string | null;
  aktif: boolean;
  sisaHari: number;
}

export async function getPremium(uid: string, now = new Date()): Promise<StatusPremium> {
  const { activeUntil } = await bacaKeanggotaan(adminDb(), uid);
  return { activeUntil, aktif: premiumAktif(activeUntil, now), sisaHari: sisaHari(activeUntil, now) };
}

export function getPremiumPeriods(uid: string): Promise<PremiumPeriodDoc[]> {
  return periodeMilik(adminDb(), uid);
}

/**
 * Dipanggil oleh ketiga jalur penyelesaian pelajaran (tandai selesai, kuis
 * lulus, kumpul tugas). Hanya pelajaran yang BARU selesai di pendaftaran
 * `source: "premium"` yang dihitung - menandai ulang tidak menambah pemakaian.
 *
 * Kegagalan dicatat ke log, tidak menggagalkan penyelesaian pelajaran: peserta
 * tidak boleh kehilangan kemajuannya karena pembukuan bagi hasil tersendat.
 */
export async function catatPemakaianPremium(input: {
  uid: string;
  course: Pick<CourseDetail, "slug" | "title" | "ownerUid" | "contributors">;
  source: string;
  baruSelesai: boolean;
}): Promise<void> {
  if (input.source !== "premium" || !input.baruSelesai) return;
  try {
    await catatPemakaian(adminDb(), {
      uid: input.uid,
      now: new Date(),
      course: { slug: input.course.slug, title: input.course.title, ownerUid: input.course.ownerUid ?? null, contributors: input.course.contributors },
    });
  } catch (err) {
    console.error(`[premium] gagal mencatat pemakaian ${input.uid} di ${input.course.slug}:`, err);
  }
}

export interface PenawaranPremium {
  /** false = jangan tampilkan ajakan sama sekali (admin sudah bisa membuka semua kursus). */
  tampil: boolean;
  aktif: boolean;
  harga: number;
  jumlah: number;
  totalSatuan: number;
}

/**
 * Data untuk `PitaPremium` di halaman yang SUDAH memuat katalog (beranda,
 * /courses, /dashboard) - katalognya dioper supaya tidak dibaca dua kali.
 * Gagal membaca setelan = ajakan disembunyikan, halaman tidak ikut gagal.
 */
export async function getPenawaranPremium(katalog: readonly { price: number; visibility?: string }[]): Promise<PenawaranPremium> {
  const kosong: PenawaranPremium = { tampil: false, aktif: false, harga: 0, jumlah: 0, totalSatuan: 0 };
  try {
    const [user, settings] = await Promise.all([getCurrentUser(), getPaymentSettings()]);
    if (user?.role === "admin") return kosong;
    const status = user ? await getPremium(user.uid) : null;
    return { tampil: true, aktif: Boolean(status?.aktif), harga: settings.premiumPrice, ...ringkasPenawaran(katalog) };
  } catch (err) {
    console.error("[premium] penawaran tidak terbaca:", err);
    return kosong;
  }
}

// ── Panel admin ──────────────────────────────────────────────────────────

export interface AnggotaPremium {
  uid: string;
  nama: string;
  email: string;
  activeUntil: string;
  sisaHari: number;
}

/** Anggota yang masih aktif, paling cepat berakhir di atas. Kueri satu field (rentang `activeUntil`). */
export async function listAnggotaAktif(now = new Date()): Promise<AnggotaPremium[]> {
  const snap = await adminDb().collection(PREMIUM_MEMBERS).where("activeUntil", ">", now.toISOString()).get();
  const baris = snap.docs.map((d) => ({ uid: d.id, activeUntil: String(d.data().activeUntil) }));
  if (baris.length === 0) return [];
  const akun = new Map<string, { nama: string; email: string }>();
  for (let i = 0; i < baris.length; i += 100) {
    const res = await adminAuth().getUsers(baris.slice(i, i + 100).map((b) => ({ uid: b.uid })));
    for (const u of res.users) akun.set(u.uid, { nama: u.displayName?.trim() || u.email?.split("@")[0] || "Pengguna", email: u.email ?? "" });
  }
  return baris
    .map((b) => ({ ...b, nama: akun.get(b.uid)?.nama ?? "(akun terhapus)", email: akun.get(b.uid)?.email ?? "", sisaHari: sisaHari(b.activeUntil, now) }))
    .sort((a, b) => a.activeUntil.localeCompare(b.activeUntil));
}

export function listPeriodeSiapDibagi(now = new Date()): Promise<PremiumPeriodDoc[]> {
  return periodeSiapDibagi(adminDb(), now);
}

export interface RingkasanPembagian {
  periodId: string;
  uid: string;
  end: string;
  gross: number;
  platformAmount: number;
  referralAmount: number;
  educatorAmount: number;
  unallocatedAmount: number;
  kursus: number;
  settledAt: string;
}

/** Pembagian terbaru (koleksinya kecil: satu dokumen per periode; diurutkan di memori). */
export async function listPembagianTerakhir(n = 20): Promise<RingkasanPembagian[]> {
  const snap = await adminDb().collection(PREMIUM_SETTLEMENTS).get();
  return snap.docs
    .map((d) => {
      const s = d.data();
      const lines = Array.isArray(s.lines) ? (s.lines as { amount?: unknown }[]) : [];
      return {
        periodId: d.id,
        uid: String(s.uid ?? ""),
        end: String(s.end ?? ""),
        gross: Number(s.gross) || 0,
        platformAmount: Number(s.platformAmount) || 0,
        referralAmount: Number(s.referralAmount) || 0,
        educatorAmount: lines.reduce((n, l) => n + (Number(l.amount) || 0), 0),
        unallocatedAmount: Number(s.unallocatedAmount) || 0,
        kursus: Array.isArray(s.perKursus) ? s.perKursus.length : 0,
        settledAt: String(s.settledAt ?? ""),
      };
    })
    .sort((a, b) => b.settledAt.localeCompare(a.settledAt))
    .slice(0, n);
}
