import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/firebase/session";
import { requireOwnedClass } from "@/lib/classGuards";
import { listClassMembers } from "@/lib/classes";
import { jamServer } from "@/lib/classAssignments";
import { getQuiz, listPercobaan, selesaikanSemua } from "@/lib/classQuizzes";
import { alasanTakBisaEkspor, barisEkspor } from "@/lib/classQuizRules";
import { getUserCards } from "@/lib/userCards";
import { buatXlsx } from "@/lib/xlsxMini";

/**
 * Lembar nilai quiz (.xlsx): `?class=…&quiz=…`. Hanya pengelola kelas (pemilik
 * atau admin) - berisi nama & poin SEMUA peserta. Ditolak (409) bila masih ada
 * esai yang belum dinilai, supaya berkas yang dibagikan tak berisi nilai sementara.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const classId = q.get("class") ?? "";
  const quizId = q.get("quiz") ?? "";
  if (!classId || !quizId) return NextResponse.json({ message: "Parameter tidak lengkap." }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const kelas = await requireOwnedClass(user, classId);
  const quiz = kelas ? await getQuiz(classId, quizId) : null;
  if (!kelas || !quiz || !quiz.published) return NextResponse.json({ message: "Quiz tidak ditemukan." }, { status: 404 });

  const percobaan = await selesaikanSemua(quiz, await listPercobaan(classId, quizId), jamServer());
  const alasan = alasanTakBisaEkspor(quiz, percobaan);
  if (alasan) return NextResponse.json({ message: alasan }, { status: 409 });

  const anggota = await listClassMembers(classId);
  const kel = quiz.settings.kelompok === true;
  // Quiz kelompok: SATU baris per anggota kelompok (nilai kelompok sama, nilai individu masing-masing); anggota kelas
  // yang belum tercatat di kelompok mana pun tetap muncul tanpa nilai.
  const tercatat = new Set(percobaan.flatMap((p) => [p.uid, ...(kel ? (p.members ?? []).map((m) => m.uid ?? "") : [])]));
  const uids = [...new Set([...anggota.map((m) => m.uid), ...percobaan.map((p) => p.uid)])];
  const kartu = await getUserCards(uids);
  const nama = (uid: string) => kartu.get(uid)?.name ?? "Peserta";
  const peserta = kel
    ? [
        ...percobaan.flatMap((p) =>
          (p.members && p.members.length > 0 ? p.members : [{ uid: p.uid, name: nama(p.uid), key: p.uid }]).map((m, i) => ({
            nama: m.name,
            p: p as typeof p | null,
            kunci: m.key ?? m.uid ?? `m${i}`,
          })),
        ),
        ...anggota.filter((m) => !tercatat.has(m.uid)).map((m) => ({ nama: nama(m.uid), p: null, kunci: m.uid })),
      ]
    : (() => {
        const peta = new Map(percobaan.map((p) => [p.uid, p]));
        return uids.map((uid) => ({ nama: nama(uid), p: peta.get(uid) ?? null, kunci: uid }));
      })();
  const baris = barisEkspor(quiz, peserta);

  const berkas = buatXlsx({ nama: "Nilai", baris, lebar: quiz.settings.kelompok ? [6, 34, 24, 15, 18, 28] : [6, 34, 10, 26] });
  const namaBerkas = `nilai-${quiz.title}`.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "nilai-quiz";
  return new NextResponse(new Uint8Array(berkas), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${namaBerkas}.xlsx"`,
      "Content-Length": String(berkas.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
