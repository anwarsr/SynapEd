import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import EnrollButton from "@/components/courses/EnrollButton";
import BuyButton from "@/components/courses/BuyButton";
import ManualQrisPanel from "@/components/courses/ManualQrisPanel";
import ReviewForm from "@/components/courses/ReviewForm";
import ReviewList from "@/components/courses/ReviewList";
import CurriculumList, { ENROLL_ANCHOR } from "@/components/courses/CurriculumList";
import Stars from "@/components/ui/Stars";
import { getCourse } from "@/lib/courses";
import { getCourseAccess } from "@/lib/courseAccess";
import { progressOf } from "@/lib/enrollments";
import { getReview, listCourseReviews } from "@/lib/reviews";
import { paymentsConfigured } from "@/lib/payments/midtrans";
import { getPaymentSettings, manualQrisReady } from "@/lib/paymentSettings";
import { findLiveManualOrder } from "@/lib/orders";
import { courseImageUrl } from "@/lib/videoEmbed";
import CourseThumb from "@/components/ui/CourseThumb";
import CourseAuthor from "@/components/ui/CourseAuthor";
import { formatPrice, iconPaths, levelTone } from "@/lib/courseUi";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Tidak ada generateStaticParams: katalog hidup di Firestore, jadi
 * membekukan daftar slug saat build berarti kursus baru tidak muncul
 * sampai di-rebuild. Halaman ini dirender saat diminta.
 */

// Tombol aksinya bergantung pada sesi dan status pendaftaran, jadi halaman
// ini tidak boleh di-prerender.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);
  return {
    title: course ? `${course.title} – SynapEd` : "Kursus – SynapEd",
    description: course?.shortDesc,
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const totalLessons = course.lessonsCount;

  // null = belum masuk. Pengunjung yang belum punya akun tetap melihat
  // seluruh halaman ini — hanya tombolnya yang berbeda.
  const access = await getCourseAccess(slug);
  const enrolled = access?.level === "full";
  const resumeSlug = access?.enrollment?.lastLessonSlug;

  // Dibaca di server lalu diteruskan sebagai prop. Client key memang publik —
  // Snap membutuhkannya di browser — tapi membacanya di sini membuat satu
  // tempat saja yang memutuskan apakah pembayaran sudah siap.
  const paymentsReady = paymentsConfigured();
  const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "";

  // Dua syarat untuk tiap metode, dan keduanya harus terpenuhi: kuncinya
  // terpasang (urusan deploy) DAN saklarnya menyala (urusan admin).
  const paymentSettings = await getPaymentSettings();
  const midtransUsable = paymentsReady && paymentSettings.midtransEnabled;
  const manualUsable = manualQrisReady(paymentSettings);
  const qrisUrl = courseImageUrl(paymentSettings.qrisImagePath);

  // Pesanan manual yang masih hidup — menentukan panel menampilkan tombol
  // mulai, formulir bukti, atau keterangan menunggu.
  const manualOrder =
    manualUsable && access && !enrolled
      ? await findLiveManualOrder(access.user.uid, slug)
      : null;

  const enrollment = access?.enrollment ?? null;
  const progress = enrollment ? progressOf(course, enrollment) : null;

  // Formulir ulasan hanya untuk yang enrollment-nya sudah selesai. Penjaga
  // sebenarnya tetap di submitReview() — ini cuma menentukan yang terlihat.
  const selesai = access?.enrollment?.status === "completed";
  const [reviews, myReview] = await Promise.all([
    listCourseReviews(slug),
    selesai && access ? getReview(access.user.uid, slug) : Promise.resolve(null),
  ]);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-32 pb-24">
        <div className="container-reading">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-ink-muted mb-10">
            <Link href="/" className="hover:text-blue-700 transition-colors">Beranda</Link>
            <span aria-hidden="true">/</span>
            <Link href="/courses" className="hover:text-blue-700 transition-colors">Kursus</Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink">{course.title}</span>
          </nav>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* min-w-0 WAJIB di sini.

                Grid item bawaannya `min-width: auto`, jadi ia menolak
                menyusut di bawah lebar min-content anaknya. Judul modul di
                kurikulum memakai `truncate` — yang berarti `white-space:
                nowrap` — sehingga lebar min-content-nya sama dengan panjang
                penuh judulnya. Tanpa min-w-0, judul terpanjang memaksa
                seluruh halaman melebar melewati layar ponsel, dan isinya
                terpotong tanpa satu pun galat.

                Bagian dalamnya sudah diberi min-w-0; yang terlewat justru
                item grid paling luar ini. */}
            <div className="lg:col-span-2 min-w-0 space-y-6">
              <div className="bg-paper-card border border-rule rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-5">
                  <Tag tone={levelTone(course.levelColor)}>{course.level}</Tag>
                  <span className="t-label text-ink-faint">{course.category}</span>
                </div>

                <h1 className="t-h2 mb-5">{course.title}</h1>
                <p className="t-body">{course.longDesc}</p>

                <div className="flex flex-wrap gap-x-8 gap-y-3 mt-8 pt-6 border-t border-rule text-sm text-ink-muted">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths.reading} />
                    </svg>
                    <span>{totalLessons} Pelajaran</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Nol ulasan dikatakan apa adanya. "0 (0 ulasan)" terbaca
                        seperti kursus yang dinilai buruk, padahal belum dinilai
                        siapa pun. */}
                    {course.reviews > 0 ? (
                      <>
                        <Stars value={course.rating} size="md" />
                        <span>
                          {course.rating.toFixed(1)} ({course.reviews} ulasan)
                        </span>
                      </>
                    ) : (
                      <span>Belum ada ulasan</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{course.enrolledStudents.toLocaleString("id-ID")} peserta</span>
                  </div>
                </div>
              </div>

              {/* Disembunyikan saat kosong.

                  Kursus yang baru dibuat bisa belum punya poin ini, dan judul
                  bagian tanpa satu pun isi di bawahnya terbaca seperti halaman
                  yang rusak, bukan seperti bagian yang memang belum diisi. */}
              {course.whatYouLearn.length > 0 && (
              <div className="bg-paper-card border border-rule rounded-2xl p-8">
                <h2 className="t-h3 mb-6">Yang Akan Anda Pelajari</h2>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3.5">
                  {course.whatYouLearn.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-ink-body leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              <div className="bg-paper-card border border-rule rounded-2xl p-8">
                <h2 className="t-h3 mb-6">Kurikulum</h2>
                <CurriculumList
                  slug={slug}
                  sections={course.sections}
                  bisaBuka={enrolled}
                  completed={enrollment?.completedLessons ?? []}
                  resumeSlug={resumeSlug}
                />
              </div>

              {/* ── Ulasan peserta ──────────────────────────────── */}
              <div id="ulasan" className="space-y-5 scroll-mt-28">
                <h2 className="t-h3">Ulasan Peserta</h2>

                {selesai && (
                  <ReviewForm
                    slug={slug}
                    initial={myReview ? { rating: myReview.rating, comment: myReview.comment } : null}
                  />
                )}

                <ReviewList
                  reviews={reviews}
                  rating={course.rating}
                  myUid={access?.user.uid ?? null}
                />
              </div>
            </div>

            <aside id={ENROLL_ANCHOR} className="min-w-0">
              <div className="bg-paper-card border border-rule rounded-2xl p-6 sticky top-28">
                <CourseThumb
                  thumbnail={course.thumbnail}
                  className="h-36 w-full rounded-2xl mb-6"
                  fallback={
                    <div className={cn("h-36 rounded-2xl flex items-center justify-center mb-6", course.tint)}>
                      <svg className="w-16 h-16 text-blue-600/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={0.8} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[course.icon] ?? iconPaths.reading} />
                      </svg>
                    </div>
                  }
                />

                <h2 className="t-h3 text-lg mb-1.5">{course.title}</h2>
                <p className="text-xs text-ink-muted mb-1.5">Diajarkan oleh</p>
                <CourseAuthor
                  name={course.instructorName}
                  uid={course.ownerUid}
                  photoURL={course.instructorPhoto}
                  size="md"
                  className="mb-5"
                />

                <p className="t-numeral text-2xl mb-6">
                  {course.price > 0 ? formatPrice(course.price) : "Gratis"}
                </p>

                {/* Kemajuan hanya untuk yang PUNYA enrollment. Pemilik kursus
                    dan admin berakses penuh tanpa pernah mendaftar; "0%" pada
                    kursus buatan sendiri hanya menyesatkan. */}
                {progress && (
                  <div className="mb-6">
                    <div className="flex items-baseline justify-between gap-3 mb-2">
                      <span className="text-xs text-ink-muted">
                        {progress.done} dari {progress.total} pelajaran
                      </span>
                      <span className="t-numeral text-xs text-ink tabular-nums">
                        {progress.percent}%
                      </span>
                    </div>
                    <span
                      className="block h-1.5 rounded-full bg-paper-alt overflow-hidden"
                      role="presentation"
                    >
                      <span
                        className="block h-full rounded-full bg-blue-600 transition-all duration-500 ease-warm"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  {enrolled ? (
                    <Button
                      href={`/courses/${slug}/learn${resumeSlug ? `/${resumeSlug}` : ""}`}
                      variant="primary"
                      className="w-full"
                    >
                      Lanjutkan Belajar
                    </Button>
                  ) : !access ? (
                    // Belum masuk. Bawa ke login dengan ?next= supaya kembali
                    // ke halaman ini setelah masuk, bukan ke beranda.
                    <Button
                      href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`}
                      variant="primary"
                      className="w-full"
                    >
                      Masuk untuk Mendaftar
                    </Button>
                  ) : course.price > 0 ? (
                    <>
                      {/* Kunci Midtrans belum terpasang, atau saklarnya dimatikan
                          admin, berarti tombolnya pasti gagal — jadi tidak
                          dirender sama sekali. */}
                      {midtransUsable && (
                        <BuyButton
                          slug={slug}
                          clientKey={midtransClientKey}
                          production={process.env.MIDTRANS_IS_PRODUCTION === "true"}
                        />
                      )}

                      {manualUsable && (
                        <ManualQrisPanel
                          slug={slug}
                          price={course.price}
                          qrisUrl={qrisUrl!}
                          qrisNote={paymentSettings.qrisNote}
                          order={
                            manualOrder
                              ? {
                                  orderId: manualOrder.orderId,
                                  amount: manualOrder.amount,
                                  status: manualOrder.status as "pending" | "awaiting_review",
                                }
                              : null
                          }
                        />
                      )}

                      {/* Kedua metode mati. Dikatakan apa adanya, bukan
                          disodori tombol yang tidak menuju ke mana-mana. */}
                      {!midtransUsable && !manualUsable && (
                        <span className="w-full rounded-lg border border-rule bg-paper-alt px-6 py-3 text-center text-sm text-ink-muted">
                          Pembayaran sedang tidak tersedia
                        </span>
                      )}
                    </>
                  ) : (
                    <EnrollButton slug={slug} />
                  )}

                  <Button href="/courses" variant="outline" className="w-full">
                    Lihat Kursus Lain
                  </Button>

                  {/* Ketentuan pembelian harus terbaca SEBELUM membayar, bukan
                      hanya tersembunyi di footer. Khusus kursus berbayar:
                      pada kursus gratis tidak ada uang yang berpindah dan
                      kalimat ini hanya jadi kebisingan. */}
                  {course.price > 0 && (
                    <p className="text-xs text-ink-muted leading-relaxed text-center pt-1">
                      Pembelian tunduk pada{" "}
                      <Link
                        href="/syarat-ketentuan"
                        className="text-blue-700 hover:underline underline-offset-4"
                      >
                        Syarat &amp; Ketentuan
                      </Link>{" "}
                      dan{" "}
                      <Link
                        href="/pengembalian-dana"
                        className="text-blue-700 hover:underline underline-offset-4"
                      >
                        Kebijakan Pengembalian Dana
                      </Link>
                      .
                    </p>
                  )}
                </div>

                {course.requirements.length > 0 && (
                <div className="mt-7 pt-6 border-t border-rule">
                  <h3 className="t-label text-ink-muted mb-4">Persyaratan</h3>
                  <ul className="space-y-2.5">
                    {course.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-ink-body leading-relaxed">
                        <span aria-hidden="true" className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                )}

                {course.lastUpdated && (
                  <p className="mt-6 pt-5 border-t border-rule text-xs text-ink-muted">
                    Terakhir diperbarui {course.lastUpdated}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
