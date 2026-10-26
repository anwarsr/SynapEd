import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireClassAccess } from "@/lib/classGuards";
import { getPost } from "@/lib/classes";
import { sajikanBerkas } from "@/lib/serveStorageFile";
import { CLASS_FILES } from "@/lib/storagePaths";

/**
 * Lampiran postingan kelas dari pengajar: `?class=…&post=…&i=<urutan>`.
 *
 * Yang diminta adalah URUTAN lampiran di postingan, bukan path — siapa yang
 * berhak dan berkas mana yang dimaksud dibaca dari dokumennya, tidak pernah
 * dari bentuk path kiriman browser.
 *
 * Bukan anggota dijawab 404 (sama seperti halaman kelasnya): jawaban yang
 * berbeda untuk "ada tapi bukan untukmu" membocorkan bahwa kelasnya ada.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const classId = q.get("class") ?? "";
  const postId = q.get("post") ?? "";
  const i = Number(q.get("i"));

  if (!classId || !postId || !Number.isInteger(i) || i < 0) {
    return NextResponse.json({ message: "Parameter tidak lengkap." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const akses = await requireClassAccess(user, classId);
  const dokumen = akses ? await getPost(classId, postId) : null;
  // Postingan terarsip tak ada bagi siswa.
  const post = dokumen && !(dokumen.archived && !akses?.isOwner) ? dokumen : null;
  const berkas = post?.attachments[i];
  if (!post || !berkas) {
    return NextResponse.json({ message: "Berkas tidak ditemukan." }, { status: 404 });
  }

  // Penjaga kedua: dokumen bisa disunting lewat Console, dan tanpa baris ini
  // route ini berubah menjadi pembaca isi bucket mana pun.
  if (!berkas.path.startsWith(`${CLASS_FILES}/${post.authorUid}/${classId}/`)) {
    return NextResponse.json({ message: "Berkas tidak sah." }, { status: 400 });
  }

  return sajikanBerkas(berkas.path, berkas.name);
}
