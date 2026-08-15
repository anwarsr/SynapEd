import { NextResponse, type NextRequest } from "next/server";
import { canViewLesson, getCourseAccess } from "@/lib/courseAccess";
import { adminStorage } from "@/lib/firebase/admin";

/**
 * Jembatan ke satu berkas lampiran pelajaran — bukan proxy Storage umum.
 *
 * lesson-assets/ dan course-assets/ di Storage sengaja dikunci total
 * (allow read: if false); handler inilah satu-satunya jalan masuk, dan ia
 * menegakkan aturan yang sama dengan halaman belajar sebelum menerbitkan
 * URL bertanda tangan yang cepat kedaluwarsa.
 *
 * Pemeriksaan "path ini benar-benar lampiran salah satu pelajaran di
 * KURSUS INI" adalah penanggung beban di sini — tanpanya, siapa pun yang
 * login bisa memakai `?path=` untuk membaca berkas kursus lain atau bucket
 * mana pun yang bisa ditebak jalurnya.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = request.nextUrl.searchParams.get("path");

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

  if (!canViewLesson(access, owningLesson)) {
    return NextResponse.json({ message: "Anda belum berhak mengakses berkas ini." }, { status: 403 });
  }

  const [url] = await adminStorage()
    .bucket()
    .file(path)
    .getSignedUrl({ action: "read", expires: Date.now() + 5 * 60 * 1000 });

  // no-store: URL ini sendiri adalah kredensial sementara — tidak boleh
  // disimpan cache browser atau CDN mana pun.
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
