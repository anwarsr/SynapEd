import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireOwnedClass } from "@/lib/classGuards";
import { getClassSubmission } from "@/lib/classAssignments";
import { sajikanBerkas } from "@/lib/serveStorageFile";
import { CLASS_SUBMISSION_FILES } from "@/lib/storagePaths";

/**
 * Berkas jawaban tugas kelas: `?id=<id pengumpulan>&i=<urutan>`.
 *
 * Hanya dua pihak: siswa pengirimnya sendiri, dan pengelola kelasnya
 * (pemilik atau admin, lewat requireOwnedClass). Siswa lain di kelas yang
 * sama TIDAK — kalau bisa, menyalin jawaban teman cukup dengan menebak ID
 * yang bentuknya deterministik.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const id = q.get("id") ?? "";
  const i = Number(q.get("i"));

  if (!id || !Number.isInteger(i) || i < 0) {
    return NextResponse.json({ message: "Parameter tidak lengkap." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });
  }

  const sub = await getClassSubmission(id);
  const berkas = sub?.files[i];
  if (!sub || !berkas) {
    return NextResponse.json({ message: "Berkas tidak ditemukan." }, { status: 404 });
  }

  const pengirim = sub.uid === user.uid;
  const pengelola = pengirim ? false : Boolean(await requireOwnedClass(user, sub.classId));
  if (!pengirim && !pengelola) {
    return NextResponse.json({ message: "Anda tidak berhak melihat berkas ini." }, { status: 403 });
  }

  if (!berkas.path.startsWith(`${CLASS_SUBMISSION_FILES}/${sub.uid}/${sub.classId}/${sub.postId}/`)) {
    return NextResponse.json({ message: "Berkas tidak sah." }, { status: 400 });
  }

  return sajikanBerkas(berkas.path, berkas.name);
}
