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

/** URL unduhan publik untuk berkas di Firebase Storage. */
export function storageDownloadUrl(path: string): string {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

export function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
