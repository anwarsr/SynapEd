import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireClassAccess } from "@/lib/classGuards";
import { getPercobaan, getQuiz, peringatanRef } from "@/lib/classQuizzes";
import { peringatanBerlaku, toPeringatan } from "@/lib/classQuizRules";

/**
 * Peringatan quiz untuk siswa yang sedang membuka kelas: `?class=…`.
 *
 * Dipoll klien tiap beberapa detik. Hanya ANGGOTA (bukan pemilik) yang dilayani,
 * dan respons hanya berisi peringatan untuk uid SESI - tidak pernah daftar sasaran.
 * Jawaban `{alert: null}` bila tak ada; tak pernah di-cache.
 */
export async function GET(request: Request) {
  const classId = new URL(request.url).searchParams.get("class") ?? "";
  const tanpa = () => NextResponse.json({ alert: null }, { headers: { "Cache-Control": "no-store" } });
  if (!classId) return NextResponse.json({ message: "Parameter tidak lengkap." }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const akses = await requireClassAccess(user, classId);
  if (!akses || !akses.isMember || akses.isOwner) return tanpa();

  const sekarang = Date.now();
  const snap = await peringatanRef(classId).get();
  const kandidat = snap.docs.map((d) => toPeringatan(d.id, d.data())).filter((p) => p.uids.includes(user.uid) && sekarang - Date.parse(p.at) <= 150_000);

  for (const p of kandidat.sort((a, b) => b.at.localeCompare(a.at))) {
    const quiz = await getQuiz(classId, p.quizId);
    const sudahMulai = (await getPercobaan(classId, p.quizId, user.uid)) !== null;
    if (peringatanBerlaku(p, quiz, user.uid, sudahMulai, sekarang)) {
      return NextResponse.json(
        { alert: { quizId: p.quizId, at: p.at, title: quiz?.title ?? "Quiz" } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return tanpa();
}
