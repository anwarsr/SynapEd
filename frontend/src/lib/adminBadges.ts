import "server-only";
import { pendingApplicationCount } from "@/lib/educator";
import { pendingRequestCount } from "@/lib/courseRequests";
import { countOrdersAwaitingReview } from "@/lib/orders";

/**
 * Angka pada lencana navigasi admin.
 *
 * Dikumpulkan di satu tempat karena bilah navigasinya sama di SETIAP halaman
 * admin: kalau tiap halaman menghitung sendiri, cepat atau lambat ada satu
 * yang lupa salah satunya, dan lencananya hilang hanya di halaman itu — cacat
 * yang tidak akan terlihat sampai seseorang kebetulan berada di sana saat ada
 * pengajuan masuk.
 *
 * Dua kueri count(), bukan dua pembacaan koleksi: yang dibutuhkan hanya
 * angkanya, dan biayanya tidak ikut naik seiring jumlah dokumen.
 */
export interface AdminBadges {
  /** Pengajuan menjadi educator yang masih menunggu. */
  applications: number;
  /** Pengajuan perubahan kursus yang masih menunggu. */
  requests: number;
  /** Pembayaran QRIS manual yang menunggu diperiksa. */
  payments: number;
}

export async function adminBadges(): Promise<AdminBadges> {
  const [applications, requests, payments] = await Promise.all([
    pendingApplicationCount(),
    pendingRequestCount(),
    countOrdersAwaitingReview(),
  ]);

  return { applications, requests, payments };
}
