import { AVATARS } from "@/lib/storagePaths";

/**
 * URL gambar kelas/quiz yang sah: Storage proyek ini + path
 * `avatars/{uid-SESI}/class-<hex>.jpg` (folder & aturan tulis yang sama dengan
 * foto profil, jadi storage.rules tak perlu diubah). Tanpa pemeriksaan ini
 * sebuah action bisa dipakai menautkan gambar sembarang - atau milik orang lain.
 * Mengembalikan null bila tak sah.
 */
export function urlGambarSah(raw: unknown, uid: string): string | null {
  if (typeof raw !== "string" || raw.length > 900 || !raw.startsWith("https://firebasestorage.googleapis.com/v0/b/")) {
    return null;
  }
  const m = raw.match(/\/o\/([^?]+)/);
  if (!m) return null;
  try {
    const path = decodeURIComponent(m[1]);
    return new RegExp("^" + AVATARS + "/" + uid + "/class-[a-f0-9]{8,32}\\.jpg$").test(path) ? raw : null;
  } catch {
    return null;
  }
}

/** Path objek dari URL gambar (untuk dibuang); null bila bukan gambar kelas. */
export function pathGambar(url: string | null | undefined): string | null {
  const m = url?.match(/\/o\/([^?]+)/);
  if (!m) return null;
  try {
    const path = decodeURIComponent(m[1]);
    return new RegExp("^" + AVATARS + "/[^/]+/class-[a-f0-9]{8,32}\\.jpg$").test(path) ? path : null;
  } catch {
    return null;
  }
}
