import { NextResponse, type NextRequest } from "next/server";
import { canViewLesson, getCourseAccess } from "@/lib/courseAccess";
import { adminStorage } from "@/lib/firebase/admin";
import { CLASS_FILES } from "@/lib/storagePaths";

/**
 * Berkas GLB objek 3D sebuah pelajaran kursus: `?lesson=<slug pelajaran>`.
 *
 * Dibaca peramban lewat fetch() oleh pemuat model, bukan diunduh pengguna, jadi disajikan sebagai `model/gltf-binary`
 * dengan `nosniff` + CSP `sandbox`. Hak akses SAMA dengan lampiran materi (`canViewLesson`: pendaftar aktif, pemilik,
 * admin); berkasnya dicari dari dokumen kursus (bukan dari path kiriman browser) dan 12 byte pertamanya diperiksa
 * (penanda "glTF" + versi 2) sebelum dikirim, karena unggahannya bermetadata ZIP (storage.rules) dan nama `.glb` tak dipercaya.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lessonSlug = request.nextUrl.searchParams.get("lesson") ?? "";
  if (!lessonSlug) return NextResponse.json({ message: "Parameter lesson wajib diisi." }, { status: 400 });

  const access = await getCourseAccess(slug);
  if (!access) return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const pelajaran = access.course.sections.flatMap((s) => s.lessons).find((l) => l.slug === lessonSlug);
  const berkas = pelajaran?.model3d?.file;
  if (!pelajaran || !berkas) return NextResponse.json({ message: "Objek 3D tidak ditemukan." }, { status: 404 });

  if (!canViewLesson(access)) {
    return NextResponse.json({ message: "Anda belum berhak mengakses objek ini." }, { status: 403 });
  }

  // Penjaga kedua: dokumen bisa disunting lewat Console.
  if (!berkas.path.startsWith(`${CLASS_FILES}/`) || !berkas.path.includes("/course-3d/") || berkas.path.includes("..")) {
    return NextResponse.json({ message: "Berkas tidak sah." }, { status: 400 });
  }

  const file = adminStorage().bucket().file(berkas.path);
  const [ada] = await file.exists();
  if (!ada) return NextResponse.json({ message: "Berkas sudah tidak ada." }, { status: 404 });

  const [buffer] = await file.download();
  if (buffer.length < 12 || buffer.toString("latin1", 0, 4) !== "glTF" || buffer.readUInt32LE(4) !== 2) {
    return NextResponse.json({ message: "Berkas bukan GLB yang sah." }, { status: 415 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(buffer.length),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=300",
    },
  });
}
