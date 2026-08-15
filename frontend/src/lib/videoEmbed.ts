/**
 * Mengubah tautan YouTube/Vimeo biasa menjadi URL embed.
 *
 * Yang ditempel orang ke Firebase Console biasanya tautan dari bilah alamat
 * ("watch?v=..." atau "youtu.be/..."), bukan URL embed. Menaruhnya langsung
 * di <iframe> akan ditolak YouTube, jadi konversinya dilakukan di sini.
 * Tautan yang sudah berbentuk embed dibiarkan apa adanya.
 */
export function toEmbedUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;

  // Sudah embed
  if (/youtube\.com\/embed\//.test(url) || /player\.vimeo\.com\/video\//.test(url)) {
    return url;
  }

  // youtu.be/<id>
  const short = url.match(/youtu\.be\/([\w-]{6,})/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;

  // youtube.com/watch?v=<id>  (juga menangani &t=, &list=)
  const watch = url.match(/[?&]v=([\w-]{6,})/);
  if (watch && /youtube\.com/.test(url)) return `https://www.youtube.com/embed/${watch[1]}`;

  // youtube.com/shorts/<id>
  const shorts = url.match(/youtube\.com\/shorts\/([\w-]{6,})/);
  if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;

  // vimeo.com/<id>
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}

/**
 * URL unduhan lampiran pelajaran — lewat route API kita sendiri, bukan
 * langsung ke Storage.
 *
 * Storage untuk lesson-assets/course-assets sudah dikunci (allow read: if
 * false); route ini yang memeriksa enrollment lalu menerbitkan signed URL
 * berumur pendek. Dulu fungsi ini membangun URL Storage publik langsung —
 * itulah sebabnya materi kursus berbayar bisa diunduh siapa saja yang
 * punya tautannya, terlepas dari status bayar.
 */
export function lessonAssetUrl(courseSlug: string, path: string, download = false): string {
  const suffix = download ? "&download=1" : "";
  return `/api/courses/${courseSlug}/asset?path=${encodeURIComponent(path)}${suffix}`;
}

/**
 * Jenis berkas yang bisa ditampilkan langsung di halaman.
 *
 * Hanya PDF. Berkas Word sempat didukung, tetapi tampilannya tidak pernah
 * setia — lihat catatan di courseUpload.ts. Lampiran .docx lama yang masih
 * tersimpan jatuh ke "none": tetap bisa diunduh, hanya tidak ditampilkan.
 */
export type PreviewKind = "pdf" | "none";

export function previewKind(name: string, mime?: string): PreviewKind {
  const isPdf = mime === "application/pdf" || name.toLowerCase().endsWith(".pdf");
  return isPdf ? "pdf" : "none";
}

/**
 * Alamat gambar latar kursus, dari nilai `thumbnail` yang tersimpan.
 *
 * Ada tiga bentuk di data yang nyata, dan ketiganya harus tetap bekerja:
 *   - path Storage  ("course-thumbnails/…")  -> unggahan educator
 *   - URL penuh     ("https://…")            -> kursus hasil migrasi
 *   - path lokal    ("images/…")             -> berkas di folder public/
 *
 * Gambar ini memang publik — tampil di katalog yang bisa dilihat tanpa masuk —
 * jadi tidak lewat route bertanda tangan seperti lampiran pelajaran.
 */
export function courseImageUrl(thumbnail: string | null | undefined): string | null {
  const value = thumbnail?.trim();
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) return value;

  if (value.startsWith("course-thumbnails/")) {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(value)}?alt=media`;
  }

  return value.startsWith("/") ? value : `/${value}`;
}

export function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
