import "server-only";
import { COURSE_THUMBNAILS } from "@/lib/storagePaths";

/**
 * Memeriksa path gambar latar yang dikirim browser.
 *
 * Path datang dari klien, jadi tidak boleh dipercaya — sama alasannya dengan
 * lampiran pelajaran. Tanpa pemeriksaan ini, seorang educator bisa menunjuk
 * gambar milik akun lain, atau menunjuk berkas di folder mana pun di bucket.
 *
 * Nilai kosong sah dan berarti "tanpa gambar": kartunya memakai latar bawaan.
 * Kursus hasil migrasi yang thumbnail-nya berupa URL atau path lokal tidak
 * lewat sini — nilainya hanya berubah kalau educator mengunggah yang baru.
 */
export function resolveThumbnail(
  raw: string | null | undefined,
  /**
   * Folder siapa saja yang sah untuk kursus ini.
   *
   * Boleh lebih dari satu, dan itu bukan kelonggaran: sejak penyuntingan
   * langsung menjadi khusus admin, gambar yang sudah ada berada di folder
   * PEMILIK kursus sementara pemanggilnya admin. Dengan satu uid saja, admin
   * tidak akan pernah bisa menyentuh gambar latar kursus milik orang lain —
   * dan kegagalannya muncul sebagai "Gambar latar tidak sah", pesan yang
   * menyesatkan karena gambarnya justru sah.
   */
  uids: string | readonly string[],
): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: true, value: null };

  const allowed = typeof uids === "string" ? [uids] : uids;
  const owned = allowed.some((uid) => uid && value.startsWith(`${COURSE_THUMBNAILS}/${uid}/`));

  if (!owned) return { ok: false, error: "Gambar latar tidak sah." };
  return { ok: true, value };
}
