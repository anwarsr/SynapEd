import { NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireOwnedCourse } from "@/lib/educatorCourses";
import { getSubmission } from "@/lib/submissions";
import { SUBMISSION_FILES } from "@/lib/storagePaths";

/**
 * Menyajikan berkas tugas yang dikumpulkan peserta.
 *
 * Berkasnya tertutup di storage.rules (`allow read: if false`), jadi tidak ada
 * URL yang bisa dibagikan atau ditebak. Pola yang sama dengan
 * /api/payments/proof dan /api/courses/[slug]/asset.
 *
 * Yang diminta pemanggil adalah `id` PENGUMPULAN, bukan path berkas — dengan
 * begitu siapa yang berwenang dibaca langsung dari dokumennya, bukan ditebak
 * dari bentuk path.
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "Parameter id wajib diisi." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const submission = await getSubmission(id);
  if (!submission?.filePath) {
    return NextResponse.json({ message: "Berkas tidak ditemukan." }, { status: 404 });
  }

  // Pengumpulnya sendiri, atau educator pemilik kursusnya (admin ikut lewat
  // requireOwnedCourse). Selain itu tidak ada.
  const pemilikTugas = submission.uid === user.uid;
  const pengajar = pemilikTugas
    ? false
    : Boolean(await requireOwnedCourse(user, submission.courseSlug));

  if (!pemilikTugas && !pengajar) {
    return NextResponse.json({ message: "Anda tidak berhak melihat berkas ini." }, { status: 403 });
  }

  // Penjaga kedua. Path tersimpan sudah diperiksa awalannya saat ditulis, tapi
  // dokumen bisa disunting langsung lewat Console — dan tanpa baris ini, route
  // ini berubah jadi pembaca isi bucket mana pun.
  if (!submission.filePath.startsWith(`${SUBMISSION_FILES}/${submission.uid}/`)) {
    return NextResponse.json({ message: "Berkas tidak sah." }, { status: 400 });
  }

  const file = adminStorage().bucket().file(submission.filePath);

  const [exists] = await file.exists();
  if (!exists) {
    return NextResponse.json({ message: "Berkas sudah tidak ada." }, { status: 404 });
  }

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  // Nama dikutip dan tanda kutipnya dilucuti — nama berkas dari peserta bisa
  // memuat karakter apa saja, dan header yang rusak membuat unduhan gagal.
  const nama = submission.fileName.replace(/["\\r\n]/g, "");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      // SELALU sebagai unduhan, tidak pernah inline.
      //
      // Jenis berkasnya bebas, jadi membiarkan browser merendernya sendiri
      // berarti mengizinkan HTML/SVG kiriman peserta dieksekusi di domain ini
      // — dengan sesi educator yang sedang membukanya.
      "Content-Type": metadata.contentType ?? "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${nama}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
