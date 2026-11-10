import Link from "next/link";
import { cookies } from "next/headers";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Button from "@/components/ui/Button";
import BuyButton from "@/components/courses/BuyButton";
import ManualQrisPanel from "@/components/courses/ManualQrisPanel";
import CourseCard from "@/components/courses/CourseCard";
import ReferralField, { ReferralProvider } from "@/components/courses/ReferralField";
import { adminAuth } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { listCourses } from "@/lib/courses";
import { formatPrice } from "@/lib/courseUi";
import { findLiveManualOrder } from "@/lib/orders";
import { getPaymentSettings, manualQrisReady } from "@/lib/paymentSettings";
import { paymentsConfigured } from "@/lib/payments/midtrans";
import { getPremium } from "@/lib/premium";
import { PREMIUM_HARI, PREMIUM_PENGINGAT_HARI, PREMIUM_SLUG, ringkasPenawaran } from "@/lib/premiumRules";
import { resolveReferral } from "@/lib/referrals";
import { REFERRAL_COOKIE, REFERRAL_PARAM } from "@/lib/referralRules";
import { courseImageUrl } from "@/lib/videoEmbed";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium – SynapEd",
  description: "SynapEd Premium: belajar dari semua kursus berbayar selama 30 hari dengan satu pembayaran - termasuk kuis, tugas, dan sertifikat.",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const tanggal = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" });

/**
 * Halaman SynapEd Premium (publik): manfaat, harga dari setelan admin, status
 * anggota, dan pembelian lewat jalur yang SAMA dengan pembelian kursus
 * (Midtrans + QRIS manual, kode referral). Akses premium tidak pernah
 * diberikan halaman ini - hanya webhook bertanda tangan & keputusan admin.
 *
 * Isinya sengaja berbicara tentang MANFAAT bagi pembeli (pelajar maupun
 * educator). Cara uang premium dibagi ke educator tidak dijelaskan di sini -
 * itu bukan alasan orang membeli; educator melihatnya di halaman Pendapatan.
 */
export default async function PremiumPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  const [settings, kursus, status] = await Promise.all([
    getPaymentSettings(),
    listCourses(),
    user ? getPremium(user.uid) : Promise.resolve(null),
  ]);

  const harga = settings.premiumPrice;
  const { jumlah: jumlahKursus, totalSatuan } = ringkasPenawaran(kursus);
  const hemat = totalSatuan - harga;
  // Etalase: kursus berbayar dengan rating tertinggi (seri: ulasan terbanyak).
  const etalase = kursus
    .filter((k) => k.price > 0 && k.visibility !== "private")
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, 3);
  const admin = user?.role === "admin";
  const midtransUsable = paymentsConfigured() && settings.midtransEnabled;
  const manualUsable = manualQrisReady(settings);
  const qrisUrl = courseImageUrl(settings.qrisImagePath);
  const manualOrder = manualUsable && user ? await findLiveManualOrder(user.uid, PREMIUM_SLUG, "premium") : null;

  // Kode referral dari tautan / cookie - aturan yang sama dengan halaman kursus.
  let referralAwal: { code: string; referrerName: string | null } | null = null;
  if (user) {
    const dariTautan = (await searchParams)[REFERRAL_PARAM];
    const kodeMasuk = (typeof dariTautan === "string" ? dariTautan : "") || (await cookies()).get(REFERRAL_COOKIE)?.value || "";
    if (kodeMasuk) {
      const ref = await resolveReferral(kodeMasuk, user.uid);
      if (ref.ok && ref.referral) {
        const perujuk = await adminAuth().getUser(ref.referral.uid).catch(() => null);
        referralAwal = { code: ref.referral.code, referrerName: perujuk?.displayName?.trim() || null };
      }
    }
  }

  const manfaat = [
    {
      judul: "Semua kursus berbayar terbuka",
      isi: "Materi, video, kuis, dan tugas dari setiap kursus berbayar - tanpa membeli satu per satu. Kursus baru yang terbit ikut terbuka.",
    },
    {
      judul: "Sertifikat resmi",
      isi: "Selesaikan kursus dan dapatkan sertifikat yang bisa diverifikasi siapa pun. Sertifikatnya milik Anda selamanya.",
    },
    {
      judul: "Belajar sesuka hati",
      isi: "Pindah dari satu kursus ke kursus lain kapan saja, sebanyak yang Anda mau. Asisten SynapEd siap membantu di setiap pelajaran.",
    },
    {
      judul: "Kemajuan tidak pernah hilang",
      isi: "Kalau masa aktif habis, kemajuan dan nilai Anda tetap tersimpan. Perpanjang, lalu lanjut tepat dari pelajaran terakhir.",
    },
  ];

  const tanya = [
    { t: "Apakah diperpanjang otomatis?", j: `Tidak. Anda membayar sekali untuk ${PREMIUM_HARI} hari, tanpa tagihan otomatis. Perpanjang hanya kalau Anda mau.` },
    { t: "Kalau saya perpanjang sebelum habis?", j: `${PREMIUM_HARI} hari baru ditambahkan di belakang tanggal berakhir, jadi tidak ada satu hari pun yang terbuang.` },
    { t: "Bagaimana cara mulai belajar?", j: "Setelah Premium aktif, buka kursus berbayar mana pun lalu tekan \"Pelajari dengan Premium\". Anda langsung masuk ke ruang belajar." },
    {
      t: "Saya educator. Bisa ikut Premium?",
      j: "Bisa. Semua kursus berbayar dari educator lain terbuka untuk Anda - cara cepat belajar dan mencari inspirasi. Kursus Anda sendiri tetap Anda kelola seperti biasa.",
    },
    { t: "Kursus mana saja yang termasuk?", j: "Semua kursus berbayar di katalog, ditandai \"Termasuk Premium\" di kartunya. Kursus gratis tetap gratis untuk semua orang." },
    { t: "Saya sudah membeli beberapa kursus.", j: "Kursus yang Anda beli tetap milik Anda selamanya, dengan atau tanpa Premium. Premium menambahkan semua kursus lainnya." },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-paper pb-24 pt-32">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <section>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-blue-300">SynapEd Premium</p>
              <h1 className="mt-3 text-4xl font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-6xl">
                Semua kursus,
                <br />
                satu pembayaran.
              </h1>
              <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-ink-body">
                Belajar dari seluruh kursus berbayar SynapEd selama {PREMIUM_HARI} hari - lengkap dengan kuis, tugas, dan sertifikat.
                Untuk pelajar maupun educator. Tanpa langganan otomatis.
              </p>

              {/* Angka penawaran dari katalog sungguhan */}
              {jumlahKursus > 0 && (
                <dl className="mt-10 grid max-w-2xl grid-cols-1 gap-1 sm:grid-cols-3">
                  <div className="bg-paper-card px-6 py-5">
                    <dd className="text-3xl font-extrabold tabular-nums tracking-[-0.03em] text-ink">{jumlahKursus}</dd>
                    <dt className="mt-1.5 text-[12.5px] text-ink-muted">kursus berbayar terbuka</dt>
                  </div>
                  {hemat > 0 && (
                    <div className="bg-paper-card px-6 py-5">
                      <dd className="text-3xl font-extrabold tabular-nums tracking-[-0.03em] text-ink-muted line-through decoration-2">
                        {formatPrice(totalSatuan)}
                      </dd>
                      <dt className="mt-1.5 text-[12.5px] text-ink-muted">kalau dibeli satu per satu</dt>
                    </div>
                  )}
                  <div className="keep-white bg-blue-600 px-6 py-5">
                    <dd className="text-3xl font-extrabold tabular-nums tracking-[-0.03em] text-white">{formatPrice(harga)}</dd>
                    <dt className="mt-1.5 text-[12.5px] text-white/80">dengan Premium, {PREMIUM_HARI} hari</dt>
                  </div>
                </dl>
              )}

              <ol className="mt-12 grid gap-1 sm:grid-cols-2">
                {manfaat.map((m, i) => (
                  <li key={m.judul} className="bg-paper-card p-6">
                    <span className="block text-4xl font-extrabold tabular-nums leading-none tracking-[-0.03em] text-white">{String(i + 1).padStart(2, "0")}</span>
                    <span className="mt-4 block text-lg font-semibold text-ink">{m.judul}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-ink-muted">{m.isi}</span>
                  </li>
                ))}
              </ol>

              {etalase.length > 0 && (
                <div className="mt-16">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="t-h3">Langsung terbuka untuk Anda</h2>
                    {/* Gaya sama dengan tombol "Lihat semua kursus" di beranda: kotak, panah bergeser, biru saat hover. */}
                    <Link
                      href="/courses"
                      className="group inline-flex items-center gap-2.5 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out-soft hover:bg-blue-600"
                    >
                      Lihat semua {jumlahKursus} kursus
                      <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                        →
                      </span>
                    </Link>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {etalase.map((c, i) => (
                      <CourseCard key={c.slug} course={c} nomor={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-16 max-w-3xl">
                <h2 className="t-h3 mb-6">Pertanyaan umum</h2>
                <dl className="grid gap-1">
                  {tanya.map((q) => (
                    <div key={q.t} className="bg-paper-card px-6 py-5">
                      <dt className="font-semibold text-ink">{q.t}</dt>
                      <dd className="mt-1.5 text-sm leading-relaxed text-ink-muted">{q.j}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="bg-paper-card p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{PREMIUM_HARI} hari akses penuh</p>
                <p className="mt-2 text-4xl font-bold tabular-nums text-ink">{formatPrice(harga)}</p>

                {status?.aktif && status.activeUntil && (
                  <div className="mt-6 bg-blue-500/10 px-4 py-3 shadow-[inset_3px_0_0_var(--color-blue-400)]">
                    <p className="text-sm font-semibold text-ink">Premium aktif</p>
                    <p className="mt-0.5 text-sm text-ink-body">
                      Sampai {tanggal(status.activeUntil)} - {status.sisaHari} hari lagi.
                    </p>
                  </div>
                )}
                {status?.aktif && status.sisaHari <= PREMIUM_PENGINGAT_HARI && (
                  <p role="status" className="mt-2 bg-amber-500/15 px-4 py-3 text-sm text-warn-text">
                    Premium Anda segera berakhir. Perpanjang sekarang - sisa harinya tetap terhitung.
                  </p>
                )}
                {status && !status.aktif && status.activeUntil && (
                  <p className="mt-6 text-sm text-ink-muted">Premium Anda berakhir {tanggal(status.activeUntil)}. Kemajuan belajar tetap tersimpan.</p>
                )}

                <div className="mt-6 flex flex-col gap-2.5">
                  {admin ? (
                    <p className="bg-white/[0.06] px-4 py-3 text-sm text-ink-body">Sebagai admin, Anda sudah bisa membuka semua kursus tanpa Premium.</p>
                  ) : !user ? (
                    <Button href={`/login?next=${encodeURIComponent("/premium")}`} variant="primary" className="w-full">
                      Masuk untuk Berlangganan
                    </Button>
                  ) : (
                    <ReferralProvider initial={referralAwal}>
                      {(midtransUsable || manualUsable) && <ReferralField />}
                      {midtransUsable && (
                        <BuyButton
                          slug={PREMIUM_SLUG}
                          premium
                          label={status?.aktif ? `Perpanjang ${PREMIUM_HARI} Hari` : `Beli Premium ${PREMIUM_HARI} Hari`}
                          clientKey={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? ""}
                          production={process.env.MIDTRANS_IS_PRODUCTION === "true"}
                        />
                      )}
                      {manualUsable && (
                        <ManualQrisPanel
                          slug={PREMIUM_SLUG}
                          premium
                          price={harga}
                          qrisUrl={qrisUrl!}
                          qrisNote={settings.qrisNote}
                          order={
                            manualOrder
                              ? { orderId: manualOrder.orderId, amount: manualOrder.amount, status: manualOrder.status as "pending" | "awaiting_review" }
                              : null
                          }
                        />
                      )}
                      {!midtransUsable && !manualUsable && (
                        <span className="w-full bg-white/10 px-6 py-3 text-center text-sm text-ink-muted">Pembayaran sedang tidak tersedia</span>
                      )}
                    </ReferralProvider>
                  )}
                  <Button href="/courses" variant="outline" className="w-full">
                    Lihat Kursus
                  </Button>
                </div>

                <p className="mt-5 text-center text-xs leading-relaxed text-ink-muted">
                  Pembelian tunduk pada{" "}
                  <Link href="/syarat-ketentuan" className="text-blue-700 underline-offset-4 hover:underline">
                    Syarat &amp; Ketentuan
                  </Link>{" "}
                  dan{" "}
                  <Link href="/pengembalian-dana" className="text-blue-700 underline-offset-4 hover:underline">
                    Kebijakan Pengembalian Dana
                  </Link>
                  .
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
