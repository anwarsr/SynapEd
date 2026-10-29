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
    <div className="font-medium">
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
        <ul className="space-y-3">
          {data.map(({ quiz, percobaan, papan }) => {
            const saya = percobaan.find((p) => p.uid === currentUid) ?? null;
            const status = statusQuizSiswa(quiz, saya);
            const kumpul = percobaan.filter((p) => p.submittedAt).length;
            return (
              <li key={quiz.id} className="relative flex flex-col overflow-hidden bg-paper-card lg:flex-row">
                {/* Garis status di tepi kiri: warnanya menceritakan keadaan quiz ini bagi pembaca. */}
                <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 z-10 w-1", garisStatus(quiz, status, isOwner))} />

                <div className="relative min-w-0 flex-1 p-4 pl-6">
                  {/* Kepala kartu: dengan banner, gambar melatari status + judul + deskripsi sampai ke tepi kartu. */}
                  <div className={cn(quiz.bannerURL && "relative -ml-6 -mr-4 -mt-4 mb-1 overflow-hidden px-6 pb-3.5 pt-4 pl-6")}>
                    {quiz.bannerURL && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={quiz.bannerURL} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/55 to-black/35" />
                      </>
                    )}
                    <div className="relative">
                      <div className="flex items-center justify-between gap-3">
                        <StatusQuiz quiz={quiz} sekarang={sekarang} />
                        {isOwner && quiz.published && (
                          <span className={cn("text-[12px] font-semibold", quiz.bannerURL ? "text-[#fff]/80" : "text-ink-muted")} title="Siswa yang sudah mengumpulkan">
                            {kumpul} dari {jumlahAnggota} terkumpul
                          </span>
                        )}
                      </div>

                      <h3 className={cn("mt-1.5 break-words text-[20px] font-bold leading-[1.25] tracking-[-0.01em]", quiz.bannerURL ? "text-[#fff]" : "text-ink")}>{quiz.title}</h3>
                      {quiz.bannerURL && quiz.description && (
                        <p className="mt-1 line-clamp-1 text-[13px] font-medium text-[#fff]/80">{quiz.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Tiga angka kunci sebaris: tebal & ringkas */}
                  <dl className="mt-3 flex items-end gap-6">
                    {[
                      { n: String(quiz.questions.length), l: "Soal" },
                      { n: String(TOTAL_POIN), l: "Poin" },
                      { n: quiz.settings.durationMin !== null ? String(quiz.settings.durationMin) : null, l: quiz.settings.durationMin !== null ? "Menit" : "Bebas waktu" },
                    ].map((x) => (
                      <div key={x.l} className="flex flex-col">
                        <dd className="order-1 flex h-[28px] items-center text-[26px] font-bold leading-none text-ink">
                          {x.n ?? <TakHingga />}
                        </dd>
                        <dt className="order-2 mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-muted">{x.l}</dt>
                      </div>
                    ))}
                  </dl>

                  {(quiz.settings.shuffleQuestions || (quiz.published && quiz.opensAt)) && (
                    <p className="mt-2.5 flex flex-wrap gap-x-3 text-[12px] font-semibold text-ink-muted">
                      {quiz.settings.shuffleQuestions && <span>Soal diacak</span>}
                      {quiz.published && quiz.opensAt && (
                        <span>
                          {sudahDibuka(quiz, sekarang) ? "Mulai" : "Dibuka"} {formatWib(quiz.opensAt)}
                        </span>
                      )}
                    </p>
                  )}

                  {isOwner ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Link href={`/educator/classes/${classId}/quiz/${quiz.id}`} className={TOMBOL_KOTAK}>
                        <QuizIkon nama="sunting" />
                        Sunting
                      </Link>
                      {quiz.published && (
                        <Link href={`${basePath}?tab=pantau&quiz=${quiz.id}`} className={TOMBOL_KOTAK}>
                          <QuizIkon nama="pantau" />
                          Pantau
                        </Link>
                      )}
                      {quiz.published && <TutupBukaQuizButton classId={classId} quizId={quiz.id} ditutup={quiz.closed} />}
                      <HapusQuizButton classId={classId} quizId={quiz.id} />
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <AksiSiswa classId={classId} quiz={quiz} belumDibuka={!sudahDibuka(quiz, sekarang)} status={status} sudahMulai={saya !== null} nilai={saya?.submittedAt ? hitungNilai(quiz, saya).total : null} />
                    </div>
                  )}
                </div>

                {/* Papan peringkat: kotak berwarna sama dengan kartu, tingginya menentukan tinggi kartu. */}
                <QuizPodium baris={papan} className="lg:w-[236px]" rayakan={papan[0]?.uid === currentUid && saya?.submittedAt != null} />
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
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.26em]", warna)}>
      {label}
    </span>
  );
}

/** Warna garis status di tepi kartu (semuanya keluarga biru). */
function garisStatus(quiz: Quiz, status: ReturnType<typeof statusQuizSiswa>, pengelola: boolean): string {
  if (pengelola) return !quiz.published ? "bg-white/15" : quiz.closed ? "bg-blue-800" : "bg-blue-600";
  if (status === "berlangsung") return "pantau-garis bg-blue-300";
  if (status === "dinilai") return "bg-blue-600";
  if (status === "perlu_dinilai") return "bg-blue-400";
  return "bg-white/15";
}

/** Tanda tak-hingga garis tipis (glyph ∞ tidak ada di Plus Jakarta Sans). */
function TakHingga() {
  return (
    <svg className="h-7 w-11" viewBox="0 0 56 28" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-label="tanpa batas">
      <path d="M28 14c-4-7-8-9-12-9a9 9 0 000 18c4 0 8-2 12-9zm0 0c4 7 8 9 12 9a9 9 0 000-18c-4 0-8 2-12 9z" />
    </svg>
  );
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
          className="group inline-flex items-center gap-2.5 bg-white/[0.07] px-5 py-2.5 text-[13px] font-semibold tracking-[0.02em] text-ink transition-colors duration-300 hover:bg-white/[0.14]"
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
