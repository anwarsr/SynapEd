import "server-only";
import { NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";
import { mimeTampil } from "@/lib/classAssignmentRules";

/**
 * Mengalirkan satu berkas Storage tertutup sebagai UNDUHAN.
 *
 * Pemanggil wajib sudah memeriksa siapa yang meminta dan awalan path-nya;
 * fungsi ini hanya menyajikan. Pola header-nya sama dengan
 * /api/submissions/file: bawaannya `attachment` + `nosniff`. Berkas kiriman
 * pengguna yang dirender browser (HTML/SVG) dieksekusi di domain ini dengan
 * sesi orang yang membukanya, jadi INLINE (`lihat`) hanya untuk jenis yang
 * aman dalam `mimeTampil` (PDF, JPG/PNG, TXT) dan Content-Type-nya ditetapkan
 * SERVER dari ekstensi, bukan dipercaya dari metadata. Jenis lain tetap diunduh
 * walau diminta inline. Teks/gambar diberi CSP `sandbox` (PDF tidak: penampil
 * PDF peramban gagal di bawah sandbox; ia berjalan di sandbox-nya sendiri).
 */
export async function sajikanBerkas(path: string, namaTampil: string, lihat = false): Promise<NextResponse> {
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

  const mimeLihat = lihat ? mimeTampil(namaTampil) : null;
  const headers: Record<string, string> = {
    "Content-Type": mimeLihat ?? metadata.contentType ?? "application/octet-stream",
    "Content-Length": String(buffer.length),
    "Content-Disposition": `${mimeLihat ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(bersih)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
  if (mimeLihat && mimeLihat !== "application/pdf") {
    headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
  }

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
