import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import BackLink from "@/components/ui/BackLink";
import QuizPengerja from "@/components/classes/quiz/QuizPengerja";
import QuizHasil from "@/components/classes/quiz/QuizHasil";
import { MulaiQuizButton } from "@/components/classes/quiz/QuizAksi";
import { requireClassAccess } from "@/lib/classGuards";
import { jamServer } from "@/lib/classAssignments";
import {
  getPercobaan,
  getQuiz,
  selesaikanBilaPerlu,
  soalUntukSiswa,
} from "@/lib/classQuizzes";
import { formatWib } from "@/lib/classAssignmentRules";
import { TOTAL_POIN, sisaDetik, sudahDibuka } from "@/lib/classQuizRules";
import { requireUser } from "@/lib/firebase/session";
import PeringatanQuiz from "@/components/classes/quiz/PeringatanQuiz";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; quizId: string }>;
}

export const metadata: Metadata = { title: "Quiz – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Halaman quiz dari sisi siswa: mulai → mengerjakan → hasil.
 *
 * Yang dibaca hanya percobaan MILIK pembaca (id deterministik dari uid sesi).
 * Pemilik/admin dialihkan ke halaman pengelola. Quiz yang belum diterbitkan
 * dijawab 404 seperti kelas yang bukan miliknya. Soal dikirim ke komponen
 * pengerja dalam urutan siswa itu dan TANPA kunci jawaban.
 */
export default async function QuizSiswaPage({ params }: Props) {
  const { id, quizId } = await params;
  const user = await requireUser(`/kelas/${id}/quiz/${quizId}`);

  const akses = await requireClassAccess(user, id);
  if (!akses) notFound();
  if (akses.isOwner) redirect(`/educator/classes/${id}/quiz/${quizId}`);

  const quiz = await getQuiz(id, quizId);
  if (!quiz || !quiz.published) notFound();

  const sekarang = jamServer();
  const awal = await getPercobaan(id, quizId, user.uid);
  const p = awal ? await selesaikanBilaPerlu(quiz, awal, sekarang) : null;

  const mengerjakan = p !== null && !p.submittedAt;

  const durasi = quiz.settings.durationMin !== null ? quiz.settings.durationMin + quiz.extraMin : null;
  const belumDibuka = !sudahDibuka(quiz, sekarang);

  return (
    <>
      <Navbar />
      {/* Belum mulai = masih bisa ditegur; yang sedang/sudah mengerjakan tak diganggu. */}
      {p === null && <PeringatanQuiz classId={id} basePath={`/kelas/${id}`} />}

      <main className="kelas-jakarta min-h-screen font-medium bg-paper pb-28 pt-32">
        <div className="container-page">
          <BackLink href={`/kelas/${id}?tab=quiz`}>{akses.kelas.name}</BackLink>

          <div className="mx-auto mt-14 max-w-[720px]">
            {/* Kepala: judul besar + petunjuk */}
            {/* Kepala: judul + deskripsi. Dengan banner, gambar melatari seluruh kepala (menembus lebar kolom). */}
            <header className={quiz.bannerURL ? "relative -mx-6 overflow-hidden px-6 py-10 max-sm:-mx-4 max-sm:px-4" : undefined}>
              {quiz.bannerURL && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={quiz.bannerURL} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/60 to-black/35" />
                </>
              )}
              <div className="relative">
                <h1 className={`break-words text-[44px] font-semibold leading-[1.08] tracking-[-0.01em] max-sm:text-[32px] ${quiz.bannerURL ? "text-[#fff]" : "text-ink"}`}>
                  {quiz.title}
                </h1>
                {quiz.description && (
                  <p className={`mt-5 max-w-[60ch] whitespace-pre-line break-words text-[16.5px] leading-[1.8] ${quiz.bannerURL ? "text-[#fff]/85" : "text-ink-body"}`}>
                    {quiz.description}
                  </p>
                )}
              </div>
            </header>

            {p === null && (
              <section className="mt-12" aria-label="Sebelum mulai">
                {/* Tiga angka kunci, dipisah garis rambut tegak */}
                <dl className="grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-7">
                  {[
                    { n: String(quiz.questions.length), l: "Soal" },
                    { n: String(TOTAL_POIN), l: "Poin" },
                    { n: durasi !== null ? String(durasi) : null, l: durasi !== null ? "Menit" : "Tanpa batas waktu" },
                  ].map((x) => (
                    <div key={x.l} className="flex flex-col items-center px-4 text-center first:pl-0 last:pr-0">
                      <dt className="order-2 mt-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-ink-muted">{x.l}</dt>
                      <dd className="flex h-[46px] items-center text-[46px] font-semibold leading-none text-ink max-sm:h-[34px] max-sm:text-[34px]">
                        {x.n ?? (
                          <svg className="h-9 w-14 max-sm:h-7 max-sm:w-11" viewBox="0 0 56 28" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-label="tanpa batas">
                            <path d="M28 14c-4-7-8-9-12-9a9 9 0 000 18c4 0 8-2 12-9zm0 0c4 7 8 9 12 9a9 9 0 000-18c-4 0-8 2-12 9z" />
                          </svg>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                {quiz.closed ? (
                  <p className="mt-9 text-[15px] leading-[1.8] text-ink-muted">Quiz ini sudah ditutup dan tidak bisa dikerjakan lagi.</p>
                ) : belumDibuka ? (
                  <div className="mt-9">
                    <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-300">Belum dibuka</p>
                    <p className="mt-3 text-[16px] leading-[1.8] text-ink-body">
                      Quiz ini baru bisa dimulai pada <strong className="font-semibold text-ink">{formatWib(quiz.opensAt)}</strong>. Muat ulang halaman ini
                      setelah waktunya tiba.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-5 mt-10 text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">Sebelum Anda mulai</p>
                    <ol className="divide-y divide-white/[0.08]">
                      {[
                        durasi !== null
                          ? `Waktu ${durasi} menit dihitung sejak Anda menekan Mulai. Begitu habis, jawaban otomatis dikumpulkan.`
                          : "Tidak ada batas waktu. Kerjakan dengan tenang.",
                        "Jawaban tersimpan otomatis. Quiz hanya bisa dikerjakan satu kali.",
                        ...(quiz.settings.shuffleQuestions ? ["Urutan soal diacak untuk tiap siswa."] : []),
                      ].map((t, i) => (
                        <li key={i} className="flex items-center gap-5 py-4">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-white/[0.08] text-[13px] font-semibold text-ink">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-[15.5px] leading-[1.75] text-ink-body">{t}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-10">
                      <MulaiQuizButton classId={id} quizId={quizId} />
                    </div>
                  </>
                )}
              </section>
            )}
          </div>

          {mengerjakan && p && (
            <div className="mt-10">
              <QuizPengerja
                classId={id}
                quizId={quizId}
                judul={quiz.title}
                soal={soalUntukSiswa(quiz, p)}
                jawabanAwal={p.answers}
                sisaAwal={sisaDetik(quiz, p, sekarang)}
              />
            </div>
          )}

          {p?.submittedAt && (
            <div className="mt-10">
              <QuizHasil quiz={quiz} percobaan={p} />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
