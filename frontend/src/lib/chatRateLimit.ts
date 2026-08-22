import "server-only";

/**
 * Pembatas laju sederhana in-memory untuk /api/chat — jendela tetap per
 * kunci (uid kalau masuk, IP kalau tidak).
 *
 * KETERBATASAN YANG DISADARI: state ini hidup di memori satu proses Node.
 * Kalau situs ini nanti dijalankan di banyak instance server sekaligus,
 * tiap instance punya batasnya sendiri-sendiri — cukup untuk sekarang
 * karena belum ada deployment produksi multi-instance. Ganti dengan
 * penyimpanan bersama (Firestore, Redis, dsb.) kalau itu berubah.
 *
 * Tidak ada timer pembersihan: entri kedaluwarsa cukup ditimpa otomatis
 * saat kuncinya dipakai lagi. Timer `setInterval` di sini justru akan
 * terdaftar ulang setiap hot-reload dev server — jebakan sendiri yang
 * tidak sepadan untuk pembatas skala MVP ini.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

export function checkChatRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}
