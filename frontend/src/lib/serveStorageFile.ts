import "server-only";
import { NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Mengalirkan satu berkas Storage tertutup sebagai UNDUHAN.
 *
 * Pemanggil wajib sudah memeriksa siapa yang meminta dan awalan path-nya;
 * fungsi ini hanya menyajikan. Pola header-nya sama dengan
 * /api/submissions/file: selalu `attachment` + `nosniff`, tidak pernah inline —
 * berkas kiriman pengguna yang dirender browser (HTML/SVG) dieksekusi di
 * domain ini dengan sesi orang yang membukanya.
 */
export async function sajikanBerkas(path: string, namaTampil: string): Promise<NextResponse> {
  const file = adminStorage().bucket().file(path);

  const [exists] = await file.exists();
  if (!exists) {
    return NextResponse.json({ message: "Berkas sudah tidak ada." }, { status: 404 });
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  // ASCII polos untuk browser lama, `filename*` UTF-8 untuk nama berhuruf
  // non-Latin. Kutip, garis miring terbalik, dan baris baru dilucuti — header
  // yang rusak membuat unduhan gagal.
  const bersih = namaTampil.replace(/["\\\r\n]/g, "") || "berkas";
  const ascii = bersih.replace(/[^\x20-\x7e]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": metadata.contentType ?? "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(bersih)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
