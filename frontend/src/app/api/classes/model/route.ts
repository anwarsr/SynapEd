import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireClassAccess } from "@/lib/classGuards";
import { getPost } from "@/lib/classes";
import { adminStorage } from "@/lib/firebase/admin";
import { CLASS_FILES } from "@/lib/storagePaths";

/**
 * Berkas GLB objek 3D sebuah pengumuman: `?class=…&post=…`.
 *
 * Dibaca peramban lewat fetch() oleh pemuat model, bukan diunduh pengguna —
 * karena itu disajikan apa adanya sebagai `model/gltf-binary` (bukan
 * `attachment`), dengan `nosniff` supaya tak pernah ditafsirkan sebagai HTML.
 * Berkas yang hanya berisi data biner tidak dieksekusi peramban.
 *
 * Hak akses sama dengan lampiran: bukan anggota dijawab 404, dan berkasnya
 * dicari dari dokumen postingan, bukan dari path kiriman browser.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const classId = q.get("class") ?? "";
  const postId = q.get("post") ?? "";

  if (!classId || !postId) {
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
  const berkas = post?.model3d?.file;
  if (!post || !berkas) {
    return NextResponse.json({ message: "Objek 3D tidak ditemukan." }, { status: 404 });
  }

  // Penjaga kedua: dokumen bisa disunting lewat Console.
  if (!berkas.path.startsWith(`${CLASS_FILES}/${post.authorUid}/${classId}/`)) {
    return NextResponse.json({ message: "Berkas tidak sah." }, { status: 400 });
  }

  const file = adminStorage().bucket().file(berkas.path);
  const [ada] = await file.exists();
  if (!ada) return NextResponse.json({ message: "Berkas sudah tidak ada." }, { status: 404 });

  const [buffer] = await file.download();
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
