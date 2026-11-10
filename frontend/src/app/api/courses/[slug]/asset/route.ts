import { NextResponse, type NextRequest } from "next/server";
import { canViewLesson, getCourseAccess } from "@/lib/courseAccess";
import { adminStorage } from "@/lib/firebase/admin";
import { mimeTampil } from "@/lib/classAssignmentRules";

/**
 * Jembatan ke satu berkas lampiran pelajaran — bukan proxy Storage umum.
 *
 * lesson-assets/ dan course-assets/ di Storage sengaja dikunci total
 * (allow read: if false); handler inilah satu-satunya jalan masuk, dan ia
 * menegakkan aturan yang sama dengan halaman belajar.
 *
 * Pemeriksaan "path ini benar-benar lampiran salah satu pelajaran di
 * KURSUS INI" adalah penanggung beban di sini — tanpanya, siapa pun yang
 * login bisa memakai `?path=` untuk membaca berkas kursus lain atau bucket
 * mana pun yang bisa ditebak jalurnya.
 *
 * Berkasnya DIALIRKAN lewat route ini, bukan dialihkan ke signed URL.
 * Menerbitkan signed URL menuntut kemampuan menandatangani, dan kredensial
 * Application Default dari `gcloud auth application-default login` tidak
 * punya kunci privat — jadi cara lama selalu gagal 500 di komputer
 * pengembang meski berjalan di produksi. Mengalirkan sendiri bekerja sama di
 * kedua tempat, dan sekaligus memungkinkan berkasnya ditampilkan di halaman
 * (Content-Disposition: inline) alih-alih hanya bisa diunduh.
 *
 * Lampiran dibatasi 20 MB oleh storage.rules, jadi melewatkannya lewat
 * server masih murah.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = request.nextUrl.searchParams.get("path");
  const asDownload = request.nextUrl.searchParams.get("download") === "1";

  if (!path) {
    return NextResponse.json({ message: "Parameter path wajib diisi." }, { status: 400 });
  }

  const access = await getCourseAccess(slug);
  if (!access) {
    return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const owningLesson = access.course.sections
    .flatMap((s) => s.lessons)
    .find((l) => l.attachments?.some((a) => a.path === path));

  if (!owningLesson) {
    return NextResponse.json({ message: "Berkas tidak ditemukan di kursus ini." }, { status: 404 });
  }

  if (!canViewLesson(access)) {
    return NextResponse.json({ message: "Anda belum berhak mengakses berkas ini." }, { status: 403 });
  }

  const attachment = owningLesson.attachments?.find((a) => a.path === path);
  const file = adminStorage().bucket().file(path);

  const [exists] = await file.exists();
  if (!exists) {
    return NextResponse.json({ message: "Berkas sudah tidak ada." }, { status: 404 });
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  // Nama berkas dikutip dan tanda kutipnya dilucuti — nama dari educator bisa
  // memuat karakter apa saja, dan header yang rusak membuat unduhan gagal.
  const filename = (attachment?.name ?? "materi").replace(/["\\\r\n]/g, "");

  // INLINE hanya untuk jenis yang aman ditampilkan peramban (PDF, JPG/PNG, TXT) dan Content-Type-nya ditetapkan
  // dari ekstensi, bukan dipercaya dari metadata unggahan; jenis lain selalu diunduh. Dulu semua jenis dikirim
  // inline dengan tipe dari metadata, sehingga berkas HTML/SVG dari educator dieksekusi di domain ini.
  const mimeLihat = asDownload ? null : mimeTampil(filename);
  const headers: Record<string, string> = {
    "Content-Type": mimeLihat ?? metadata.contentType ?? attachment?.mime ?? "application/octet-stream",
    "Content-Length": String(buffer.length),
    "Content-Disposition": `${mimeLihat ? "inline" : "attachment"}; filename="${filename}"`,
    "X-Content-Type-Options": "nosniff",
    // Berkas ini hanya boleh dilihat peserta yang berhak; cache bersama
    // seperti CDN tidak boleh menyimpannya.
    "Cache-Control": "private, no-store",
  };
  if (mimeLihat && mimeLihat !== "application/pdf") {
    headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
  }
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
