"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { CourseDetail, Lesson } from "@/lib/courses";
import type { Progress } from "@/lib/enrollments";
import type { PublicQuiz } from "@/lib/quiz";
import { CHECK_ICON, LOCK_ICON, lessonIcons } from "@/lib/courseUi";
import { formatBytes, lessonAssetUrl, previewKind, toEmbedUrl } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";
import { useChatLessonContext } from "@/components/ui/ChatContext";
import LessonCompleteButton from "./LessonCompleteButton";
import AssignmentPanel, { type SubmissionView } from "./AssignmentPanel";
import MaterialViewer from "./MaterialViewer";
import QuizRunner from "./QuizRunner";

interface Props {
  course: CourseDetail;
  current: Lesson;
  prev: Lesson | null;
  next: Lesson | null;
  /** Slug pelajaran yang belum boleh dibuka — digembok di daftar materi. */
  locked: string[];
  /** Slug pelajaran yang sudah ditandai selesai oleh peserta ini. */
  completed: string[];
  progress: Progress;
  /**
   * Peserta sungguhan dengan enrollment aktif? Pratinjau admin/educator
   * tidak punya dokumen enrollment, jadi progresnya tidak ada yang dilacak
   * dan tombol tandai-selesai tidak ditampilkan sama sekali.
   */
  canTrackProgress: boolean;
  /**
   * Pengumpulan peserta untuk pelajaran yang sedang dibuka, kalau ada.
   * Hanya diisi untuk pelajaran penugasan & kuis.
   */
  submission: SubmissionView | null;
  /** Nilai minimum kelulusan kursus ini. */
  passingGrade: number;
  /**
   * null berarti pelajaran ini bukan kuis, ATAU kuisnya belum punya soal
   * tersimpan (kursus hasil migrasi) — kedua kasus jatuh ke tampilan
   * lampiran lama di bawah, tanpa migrasi data apa pun.
   */
  quiz: PublicQuiz | null;
  /**
   * Sertifikat yang sudah terbit untuk peserta ini, kalau ada — dibaca
   * langsung dari enrollment.certificateId (BUKAN dari sinyal sekali-pakai
   * markLessonComplete/submitQuiz), supaya kotak "Selesai" di bawah tetap
   * benar walau peserta baru membuka pelajaran terakhir ini belakangan,
   * bukan tepat saat menyelesaikannya. null berarti belum tersertifikasi
   * ATAU pratinjau admin/educator yang memang tidak punya enrollment.
   */
  certificateId: string | null;
}

/**
 * Keadaan ciut daftar materi selama satu kunjungan.
 *
 * Sengaja di luar komponen: modul ini tetap hidup selama aplikasinya berjalan
 * di tab yang sama, jadi nilainya bertahan saat berpindah pelajaran — tetapi
 * ikut hilang begitu halamannya dimuat ulang.
 */
let railHiddenMemory = false;

const typeLabel: Record<string, string> = {
  video: "Video",
  reading: "Bacaan",
  assignment: "Penugasan",
  quiz: "Kuis",
};

export default function LearnShell({
  course,
  current,
  prev,
  next,
  locked,
  completed,
  progress,
  canTrackProgress,
  submission,
  passingGrade,
  quiz,
  certificateId,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Daftar materi bisa diciutkan di layar lebar supaya materi punya ruang
  // lebih, tetapi SELALU terbuka saat kelas dibuka.
  //
  // Diingat lewat variabel modul, bukan localStorage maupun useState biasa:
  //
  //   localStorage — bertahan berhari-hari. Kelas jadi terbuka dalam keadaan
  //   terciut padahal penggunanya sudah lupa pernah menciutkannya, dan
  //   kehilangan peta kursusnya.
  //
  //   useState biasa — komponen ini DILEPAS setiap pindah pelajaran (sudah
  //   diukur, bukan diduga), jadi railnya membuka sendiri tiap klik pelajaran
  //   berikutnya dan tombolnya praktis tidak berguna.
  //
  // Variabel modul hidup selama aplikasinya berjalan di tab itu: bertahan
  // saat berpindah pelajaran, dan hilang saat halaman dimuat ulang atau kelas
  // dibuka dari awal — persis yang diinginkan.
  const [railHidden, setRailHidden] = useState(railHiddenMemory);

  function toggleRail() {
    setRailHidden((v) => {
      railHiddenMemory = !v;
      return !v;
    });
  }

  // Beritahu ChatWidget global (lewat ChatContext) pelajaran mana yang
  // sedang dibuka, supaya /api/chat bisa beralih ke mode tutor — lihat
  // komentar di ChatContext.tsx. Hanya slug yang dikirim, bukan konten.
  const { setLessonContext } = useChatLessonContext();
  useEffect(() => {
    setLessonContext({ courseSlug: course.slug, lessonSlug: current.slug });
    return () => setLessonContext(null);
  }, [course.slug, current.slug, setLessonContext]);

  // Pelajaran yang penyelesaiannya lewat pengumpulan berkas, bukan tombol.
  const butuhPengumpulan = current.type === "assignment" || current.type === "quiz";

  const lockedSet = new Set(locked);
  const doneSet = new Set(completed);

  const embedUrl = current.videoUrl ? toEmbedUrl(current.videoUrl) : null;
  const attachments = current.attachments ?? [];

  // Berkas pertama yang memang bisa ditampilkan. Sisanya tetap muncul sebagai
  // unduhan di bawah — termasuk berkas ini sendiri, bagi yang ingin menyimpannya.
  const readable = attachments.find((a) => previewKind(a.name, a.mime) !== "none") ?? null;

  return (
    /* h-screen + overflow-hidden, BUKAN min-h-screen.
       Dengan min-h-screen tinggi pembungkus ikut isinya, jadi daftar materi
       dan materi sama-sama setinggi isinya dan `overflow-y-auto` di keduanya
       tidak pernah aktif — yang bergulir sebenarnya seluruh halaman, dan
       keduanya ikut bergerak bersama. Tinggi yang dipatok layar membuat
       masing-masing punya area gulirnya sendiri. */
    <div className="h-screen overflow-hidden bg-paper flex flex-col">
      {/* ── Bilah atas ─────────────────────────────────────── */}
      <header className="shrink-0 z-40 bg-navy text-white">
        <div className="flex items-center gap-4 px-4 sm:px-6 h-14">
          {/* Ponsel: buka/tutup panel melayang. Layar lebar: ciutkan railnya. */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={sidebarOpen ? "Tutup daftar materi" : "Buka daftar materi"}
            aria-expanded={sidebarOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Ikon "panel kiri" — bentuk yang sudah lazim dipakai untuk
              menciutkan sidebar (VS Code, Notion, Linear), jadi maksudnya
              langsung terbaca. Diberi garis tepi dan latar tipis supaya
              tampak sebagai tombol di atas navy; versi sebelumnya cuma
              garis samar yang mudah dikira hiasan. */}
          <button
            onClick={toggleRail}
            className={cn(
              "hidden lg:inline-flex items-center justify-center w-9 h-9 rounded-lg border shrink-0",
              "transition-colors duration-200 ease-out-soft",
              railHidden
                ? "border-white/20 bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
                : "border-white/25 bg-white/15 text-white hover:bg-white/25",
            )}
            aria-label={railHidden ? "Tampilkan daftar materi" : "Sembunyikan daftar materi"}
            title={railHidden ? "Tampilkan daftar materi" : "Sembunyikan daftar materi"}
            aria-expanded={!railHidden}
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="3" y="4.5" width="18" height="15" rx="2.5" strokeWidth={1.6} />
              <line x1="9.5" y1="4.5" x2="9.5" y2="19.5" strokeWidth={1.6} />
              {/* Kolom kiri diarsir saat daftar materi sedang tampil, jadi
                  keadaan hidup/mati terlihat tanpa perlu menebak. */}
              {!railHidden && <rect x="3.8" y="5.3" width="5" height="13.4" rx="1.8" fill="currentColor" stroke="none" />}
            </svg>
          </button>

          <span aria-hidden="true" className="hidden lg:block w-px h-6 bg-white/15 shrink-0" />

          <Link
            href={`/courses/${course.slug}`}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Keluar dari kelas</span>
          </Link>

          <span className="hidden md:block text-sm font-medium truncate">{course.title}</span>

          <div className="ml-auto flex items-center gap-3 shrink-0">
            {canTrackProgress ? (
              <>
                <span className="text-xs text-white/70 tabular-nums">
                  {progress.done} / {progress.total} selesai
                </span>
                <div className="w-24 sm:w-40 h-1.5 rounded-full bg-white/15 overflow-hidden" role="presentation">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500 ease-warm"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </>
            ) : (
              <span className="text-xs text-white/70">Pratinjau</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar kurikulum ────────────────────────────── */}
        <aside
          className={cn(
            "shrink-0 border-r border-rule bg-paper-alt overflow-hidden",
            // Lebarnya yang dianimasikan, bukan display — display tidak bisa
            // ditransisikan, dan itulah sebabnya dulu ia hilang seketika.
            "transition-[width] duration-300 ease-out-soft motion-reduce:transition-none",
            // Di layar lebar railnya menciut sampai nol; di ponsel ia tetap
            // panel melayang yang dibuka lewat tombol menu.
            railHidden ? "lg:w-0 lg:border-r-0" : "lg:w-80",
            sidebarOpen ? "fixed inset-y-14 left-0 z-30 block w-80 shadow-lift" : "hidden lg:block",
          )}
          // Saat menciut isinya tidak boleh bisa difokus lewat Tab —
          // menggulir ke tautan yang tidak terlihat jelas membingungkan.
          //
          // React 19 memperlakukan `inert` sebagai atribut boolean sungguhan,
          // jadi cukup diberi nilai. Menitipkan string kosong lewat spread —
          // cara lama sebelum React 19 — justru dibaca sebagai false dan
          // diprotes di konsol.
          inert={railHidden && !sidebarOpen}
        >
          {/* Lebarnya dipatok supaya isinya tidak ikut memampat saat rail
              menyempit — yang diinginkan adalah tergeser keluar, bukan
              teksnya meremas jadi satu kolom sempit selama animasi. */}
          <div className="w-80 h-full overflow-y-auto p-5">
            <p className="chapter-mark mb-4">
              <span aria-hidden="true" className="w-5 h-px bg-rule-strong" />
              <span>Daftar Materi</span>
            </p>

            {course.sections.map((section, si) => (
              <div key={section.position} className="mb-6">
                <p className="flex items-baseline gap-2 mb-2.5">
                  <span className="t-numeral-ghost text-sm text-ink-faint" aria-hidden="true">
                    {String(si + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium text-ink">{section.title}</span>
                </p>

                <ul className="space-y-0.5">
                  {section.lessons.map((lesson) => {
                    const active = lesson.slug === current.slug;
                    const isLocked = lockedSet.has(lesson.slug);
                    const isDone = doneSet.has(lesson.slug);

                    // Pelajaran terkunci dirender sebagai teks, bukan tautan.
                    // Servernya tetap menolak, tapi tautan yang mengalihkan
                    // balik ke halaman penjualan adalah jalan buntu yang
                    // membingungkan.
                    const inner = (
                      <>
                        <svg
                          className={cn(
                            "w-4 h-4 mt-0.5 shrink-0",
                            active ? "text-white" : isLocked ? "text-ink-faint" : "text-blue-600",
                          )}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={
                              isLocked
                                ? LOCK_ICON
                                : isDone
                                  ? CHECK_ICON
                                  : lessonIcons[lesson.type] ?? lessonIcons.reading
                            }
                          />
                        </svg>
                        <span className="flex-1 leading-snug">{lesson.title}</span>
                        <span className={cn("text-[11px] shrink-0 mt-0.5", active ? "text-white/80" : "text-ink-faint")}>
                          {lesson.duration}
                        </span>
                      </>
                    );

                    return (
                      <li key={lesson.slug}>
                        {isLocked ? (
                          <span
                            title="Daftar kursus ini untuk membuka pelajaran"
                            className="flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-faint cursor-not-allowed"
                          >
                            {inner}
                          </span>
                        ) : (
                          <Link
                            href={`/courses/${course.slug}/learn/${lesson.slug}`}
                            aria-current={active ? "page" : undefined}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              "flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-200",
                              active
                                ? "bg-blue-600 text-white"
                                : "text-ink-body hover:bg-blue-50 hover:text-blue-700",
                            )}
                          >
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Konten pelajaran ─────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* Materi butuh ruang lebih daripada teks biasa — halaman PDF punya
              lebar tetap, dan kolom 3xl memaksanya mengecil sampai sulit
              dibaca. Melebar lagi saat daftar materi diciutkan, mengikuti
              animasi rail supaya keduanya bergerak sebagai satu gerakan. */}
          <div
            className={cn(
              "mx-auto px-6 py-10",
              "transition-[max-width] duration-300 ease-out-soft motion-reduce:transition-none",
              railHidden ? "max-w-6xl" : "max-w-5xl",
            )}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <span className="t-label text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                {typeLabel[current.type] ?? current.type}
              </span>
              <span className="text-xs text-ink-muted">{current.duration}</span>
            </div>

            <h1 className="t-h2 mb-8">{current.title}</h1>

            {current.type === "assignment" && current.instructions && (
              <section className="mb-8 rounded-2xl border border-rule bg-paper-alt p-5">
                <h2 className="t-label text-ink-muted mb-3">Instruksi Tugas</h2>
                <p className="text-sm text-ink-body whitespace-pre-line">{current.instructions}</p>
              </section>
            )}

            {quiz ? (
              <div className="mb-8">
                <QuizRunner courseSlug={course.slug} quiz={quiz} />
              </div>
            ) : (
              <>
                {embedUrl ? (
                  /* Rasio 16:9 dijaga lewat aspect-video supaya tidak bergeser
                     saat iframe dimuat. */
                  <div className="mb-8">
                    <div className="aspect-video w-full rounded-3xl overflow-hidden border border-rule bg-navy">
                      <iframe
                        src={embedUrl}
                        title={current.title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>

                    {/* Jalan keluar kalau embed-nya tidak mau jalan.
                        Penyematan YouTube bisa gagal karena hal-hal di luar
                        jangkauan aplikasi — ekstensi pemblokir, kebijakan
                        privasi peramban, jaringan yang menyaring. Tanpa
                        tautan ini peserta hanya menatap layar berputar tanpa
                        tahu harus berbuat apa. */}
                    <p className="mt-3 text-right">
                      <a
                        href={current.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-blue-700 transition-colors"
                      >
                        Videonya tidak muncul? Tonton di YouTube
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </p>
                  </div>
                ) : readable ? (
                  /* Berkasnya dibaca langsung di halaman — peserta tidak perlu
                     mengunduh apa pun untuk mulai belajar. */
                  <div className="mb-8">
                    <MaterialViewer key={readable.path} courseSlug={course.slug} file={readable} />
                  </div>
                ) : (
                  /* Keadaan kosong yang jujur: struktur pelajaran sudah ada,
                     tapi tidak ada video maupun berkas yang bisa dibaca. */
                  <div
                    className={cn(
                      "rounded-3xl border border-rule flex flex-col items-center justify-center text-center px-8 py-16 mb-8",
                      current.type === "video" ? "bg-navy" : "bg-paper-alt",
                    )}
                  >
                    <svg
                      className={cn("w-12 h-12 mb-4", current.type === "video" ? "text-blue-300" : "text-blue-600")}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={lessonIcons[current.type] ?? lessonIcons.reading} />
                    </svg>
                    <p className={cn("t-h3 text-lg mb-2", current.type === "video" && "text-white")}>
                      Materi belum tersedia
                    </p>
                    <p className={cn("text-sm max-w-sm", current.type === "video" ? "text-white/70" : "text-ink-muted")}>
                      {attachments.length > 0
                        ? "Berkasnya tidak bisa ditampilkan di halaman. Silakan unduh di bawah."
                        : "Struktur pelajaran sudah ada, tetapi tautan video dan berkasnya belum diunggah."}
                    </p>
                  </div>
                )}

                {attachments.length > 0 && (
                  <section className="mb-8">
                    <h2 className="t-label text-ink-muted mb-3">Berkas Pendukung</h2>
                    <ul className="space-y-2">
                      {attachments.map((file) => {
                        const size = formatBytes(file.size);
                        return (
                          <li key={file.path}>
                            <a
                              href={lessonAssetUrl(course.slug, file.path, true)}
                              download={file.name}
                              className="group flex items-center gap-3 rounded-2xl border border-rule bg-paper-card px-4 py-3 transition-all duration-200 ease-out-soft hover:border-blue-500 hover:-translate-y-0.5"
                            >
                              <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" d={lessonIcons.reading} />
                                </svg>
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm text-ink truncate group-hover:text-blue-700 transition-colors">
                                  {file.name}
                                </span>
                                {size && <span className="block text-xs text-ink-muted">{size}</span>}
                              </span>
                              <svg className="w-4 h-4 text-ink-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                              </svg>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {canTrackProgress &&
                  (butuhPengumpulan ? (
                    // Penugasan & kuis TIDAK punya tombol tandai-selesai:
                    // mengumpulkan berkaslah yang menandainya selesai, jadi dua
                    // tombol berdampingan hanya akan saling membingungkan.
                    <div className="mb-8">
                      <AssignmentPanel
                        courseSlug={course.slug}
                        lessonSlug={current.slug}
                        passingGrade={passingGrade}
                        submission={submission}
                      />
                    </div>
                  ) : (
                    <div className="mb-8 flex justify-end">
                      <LessonCompleteButton
                        slug={course.slug}
                        lessonSlug={current.slug}
                        done={doneSet.has(current.slug)}
                      />
                    </div>
                  ))}
              </>
            )}

            {/* Navigasi antar pelajaran */}
            <nav className="flex items-stretch gap-3 pt-6 border-t border-rule">
              {prev && !lockedSet.has(prev.slug) ? (
                <Link
                  href={`/courses/${course.slug}/learn/${prev.slug}`}
                  className="group flex-1 rounded-2xl border border-rule bg-paper-card p-4 transition-all duration-200 ease-out-soft hover:border-blue-500 hover:-translate-y-0.5"
                >
                  <span className="t-label text-ink-faint block mb-1">← Sebelumnya</span>
                  <span className="text-sm text-ink group-hover:text-blue-700 transition-colors line-clamp-1">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span className="flex-1" />
              )}

              {next && !lockedSet.has(next.slug) ? (
                <Link
                  href={`/courses/${course.slug}/learn/${next.slug}`}
                  className="group flex-1 rounded-2xl border border-rule bg-paper-card p-4 text-right transition-all duration-200 ease-out-soft hover:border-blue-500 hover:-translate-y-0.5"
                >
                  <span className="t-label text-ink-faint block mb-1">Berikutnya →</span>
                  <span className="text-sm text-ink group-hover:text-blue-700 transition-colors line-clamp-1">
                    {next.title}
                  </span>
                </Link>
              ) : next ? (
                // Pelajaran berikutnya ada tapi terkunci — katakan apa adanya,
                // jangan mengaku "pelajaran terakhir".
                <Link
                  href={`/courses/${course.slug}`}
                  className="group flex-1 rounded-2xl border border-rule bg-paper-alt p-4 text-right transition-all duration-200 ease-out-soft hover:border-blue-500"
                >
                  <span className="t-label text-ink-faint block mb-1">Terkunci</span>
                  <span className="text-sm text-ink-muted group-hover:text-blue-700 transition-colors">
                    Daftar untuk melanjutkan
                  </span>
                </Link>
              ) : certificateId ? (
                <Link
                  href={`/dashboard/certificates/${certificateId}`}
                  className="group flex-1 rounded-2xl border border-rule bg-paper-card p-4 text-right transition-all duration-200 ease-out-soft hover:border-blue-500 hover:-translate-y-0.5"
                >
                  <span className="t-label text-ink-faint block mb-1">Selesai</span>
                  <span className="text-sm text-ink group-hover:text-blue-700 transition-colors">
                    Sertifikat siap →
                  </span>
                </Link>
              ) : (
                <span className="flex-1 rounded-2xl border border-rule bg-paper-alt p-4 text-right">
                  <span className="t-label text-ink-faint block mb-1">Selesai</span>
                  <span className="text-sm text-ink-muted">Pelajaran terakhir</span>
                </span>
              )}
            </nav>

            {certificateId && (
              <p className="text-right text-sm">
                <Link
                  href={`/courses/${course.slug}#ulasan`}
                  className="text-blue-700 hover:underline underline-offset-4"
                >
                  Sudah menyelesaikan kursus ini — tinggalkan ulasan →
                </Link>
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
