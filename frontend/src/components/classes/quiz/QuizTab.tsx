import Link from "next/link";
import QuizPodium from "@/components/classes/quiz/QuizPodium";
import QuizIkon from "@/components/classes/quiz/QuizIkon";
import { TOMBOL_KOTAK } from "@/lib/quizUi";
import { HapusQuizButton, TutupBukaQuizButton } from "@/components/classes/quiz/QuizAksi";
import { jamServer } from "@/lib/classAssignments";
import { listPercobaan, listQuizzes, muatPapanPeringkat, selesaikanSemua } from "@/lib/classQuizzes";
import { formatWib } from "@/lib/classAssignmentRules";
import { LABEL_STATUS_QUIZ, TOTAL_POIN, hitungNilai, statusQuizSiswa, sudahDibuka, type Quiz } from "@/lib/classQuizRules";
import { cn } from "@/lib/cn";

/**
 * Tab "Quiz": daftar quiz kelas. Pengajar melihat semuanya (termasuk draf) +
 * tombol kelola; siswa hanya yang diterbitkan + statusnya sendiri. Di sisi
 * kanan tiap quiz ada papan peringkat 1-3.
 *
 * Komponen server async: dirender langsung oleh ClassRoom hanya saat tab ini
 * aktif, jadi percobaan quiz tak dibaca di tab lain. Percobaan yang waktunya
 * habis ditutup di sini (selesaikanSemua) sebelum peringkat dihitung.
 */
export default async function QuizTab({
  classId,
  basePath,
  currentUid,
  isOwner,
  jumlahAnggota,
}: {
  classId: string;
  basePath: string;
  currentUid: string;
  isOwner: boolean;
  jumlahAnggota: number;
}) {
  const semua = await listQuizzes(classId);
  const quizzes = isOwner ? semua : semua.filter((q) => q.published);
  const sekarang = jamServer();

  const data = await Promise.all(
    quizzes.map(async (quiz) => {
      const percobaan = quiz.published ? await selesaikanSemua(quiz, await listPercobaan(classId, quiz.id), sekarang) : [];
      return { quiz, percobaan, papan: await muatPapanPeringkat(quiz, percobaan) };
    }),
  );

  return (
    <div>
      {isOwner && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[52ch] text-sm leading-[1.7] text-ink-muted">
            Buat quiz pilihan ganda dan esai ala Google Form. Pantau pengerjaan siswa lewat tombol <strong>Pantau</strong> pada tiap quiz.
          </p>
          <Link
            href={`/educator/classes/${classId}/quiz/new`}
            className="group inline-flex items-center gap-2 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-[#fff]"
          >
            + Buat quiz
          </Link>
        </div>
      )}

      {data.length === 0 ? (
        <div className="bg-white/5 px-8 py-14 text-center">
          <p className="text-[22px] font-medium text-ink">Belum ada quiz</p>
          <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
            {isOwner ? "Buat quiz pertama dengan tombol di atas." : "Quiz dari pengajar akan muncul di sini."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map(({ quiz, percobaan, papan }) => {
            const saya = percobaan.find((p) => p.uid === currentUid) ?? null;
            const status = statusQuizSiswa(quiz, saya);
            const kumpul = percobaan.filter((p) => p.submittedAt).length;
            return (
              <li key={quiz.id} className="bg-paper-card p-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_236px]">
                  <div className="min-w-0">
                    <StatusQuiz quiz={quiz} sekarang={sekarang} />
                    <h3 className="mt-2 break-words text-[22px] font-semibold leading-[1.25] text-ink">{quiz.title}</h3>
                    {quiz.description && (
                      <p className="mt-2 line-clamp-3 whitespace-pre-line break-words text-[14.5px] leading-[1.7] text-ink-body">
                        {quiz.description}
                      </p>
                    )}

                    <p className="mt-4 text-[13px] leading-[1.9] text-ink-muted">
                      {quiz.questions.length} soal · {TOTAL_POIN} poin ·{" "}
                      {quiz.settings.durationMin !== null ? `${quiz.settings.durationMin} menit` : "tanpa batas waktu"}
                      {quiz.settings.shuffleQuestions && " · soal diacak"}
                    </p>
                    {quiz.published && quiz.opensAt && (
                      <p className="mt-1 text-[13px] text-ink-muted">
                        {sudahDibuka(quiz, sekarang) ? "Mulai" : "Dibuka"} {formatWib(quiz.opensAt)}
                      </p>
                    )}

                    {isOwner ? (
                      <>
                        {quiz.published && (
                          <p className="mt-1 text-[13px] text-ink-muted">
                            {kumpul} dari {jumlahAnggota} siswa sudah mengumpulkan
                          </p>
                        )}
                        <div className="mt-5 flex flex-wrap items-center gap-2">
                          <Link
                            href={`/educator/classes/${classId}/quiz/${quiz.id}`}
                            className={TOMBOL_KOTAK}
                          >
                            <QuizIkon nama="sunting" />
                            Sunting
                          </Link>
                          {quiz.published && (
                            <Link
                              href={`${basePath}?tab=pantau&quiz=${quiz.id}`}
                              className={TOMBOL_KOTAK}
                            >
                              <QuizIkon nama="pantau" />
                              Pantau
                            </Link>
                          )}
                          {quiz.published && <TutupBukaQuizButton classId={classId} quizId={quiz.id} ditutup={quiz.closed} />}
                          <HapusQuizButton classId={classId} quizId={quiz.id} />
                        </div>
                      </>
                    ) : (
                      <div className="mt-5 flex flex-wrap items-center gap-4">
                        <AksiSiswa classId={classId} quiz={quiz} belumDibuka={!sudahDibuka(quiz, sekarang)} status={status} sudahMulai={saya !== null} nilai={saya?.submittedAt ? hitungNilai(quiz, saya).total : null} />
                      </div>
                    )}
                  </div>

                  <QuizPodium baris={papan} className="self-start" rayakan={papan[0]?.uid === currentUid && saya?.submittedAt != null} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusQuiz({ quiz, sekarang }: { quiz: Quiz; sekarang: number }) {
  const [label, warna] = !quiz.published
    ? (["Draf", "text-blue-200"] as const)
    : quiz.closed
      ? (["Ditutup", "text-ink-muted"] as const)
      : !sudahDibuka(quiz, sekarang)
        ? (["Dijadwalkan", "text-blue-400"] as const)
        : (["Dibuka", "text-blue-300"] as const);
  return <span className={cn("text-[11px] font-bold uppercase tracking-[0.26em]", warna)}>{label}</span>;
}

function AksiSiswa({
  classId,
  quiz,
  status,
  sudahMulai,
  nilai,
  belumDibuka,
}: {
  classId: string;
  quiz: Quiz;
  belumDibuka: boolean;
  status: ReturnType<typeof statusQuizSiswa>;
  sudahMulai: boolean;
  nilai: number | null;
}) {
  const href = `/kelas/${classId}/quiz/${quiz.id}`;
  const tombol = "inline-flex items-center gap-2 bg-blue-600 px-6 py-2.5 text-sm font-semibold text-[#fff] transition-colors hover:bg-blue-700";

  if (status === "belum" && quiz.closed) {
    return <span className="text-sm text-ink-muted">Quiz sudah ditutup.</span>;
  }
  if (status === "belum" && belumDibuka) {
    return <span className="text-sm text-blue-300">Dibuka {formatWib(quiz.opensAt)}</span>;
  }
  if (status === "belum") {
    return (
      <Link href={href} className={tombol}>
        Kerjakan quiz
      </Link>
    );
  }
  if (status === "berlangsung") {
    return (
      <Link href={href} className={tombol}>
        Lanjutkan mengerjakan
      </Link>
    );
  }
  return (
    <>
      <span className="text-sm text-ink-body">
        {LABEL_STATUS_QUIZ[status]}
        {status === "dinilai" && nilai !== null && (
          <>
            {" "}
            · nilai <strong className="text-ink">{nilai}</strong>
          </>
        )}
      </span>
      {sudahMulai && (
        <Link
          href={href}
          className="group inline-flex items-center gap-2.5 bg-white/[0.07] px-5 py-2.5 text-[13px] font-semibold tracking-[0.02em] text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-colors duration-300 hover:bg-white/[0.13] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]"
        >
          Lihat hasil
          <svg className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
          </svg>
        </Link>
      )}
    </>
  );
}
