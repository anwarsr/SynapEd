import Link from "next/link";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import Tag from "@/components/ui/Tag";
import { formatDateOnly } from "@/lib/adminUsers";
import { formatPrice } from "@/lib/courseUi";
import { requireUser } from "@/lib/firebase/session";
import ReferralCodeForm from "@/components/dashboard/ReferralCodeForm";
import { getMyReferralCode } from "@/lib/referrals";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { getUsernameInfo } from "@/lib/usernames";
import { suggestReferralCode } from "@/lib/referralRules";
import {
  getMyContributions,
  getMyEarnings,
  getMySales,
  type MySales,
} from "@/lib/royaltyDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pendapatan – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Pendapatan.
 *
 * Dulu alamat ini hanya mengalihkan ke /profil. Sekarang ia rumah bagi
 * pendapatan royalti, untuk SEMUA akun — kontributor kursus tidak harus
 * educator. Educator dan admin mendapat satu bagian tambahan: penjualan
 * kursus yang mereka miliki.
 *
 * `/dashboard/certificates/[id]` tetap di alamatnya sendiri; sertifikat yang
 * sudah terbit menautkannya.
 */
export default async function EarningsDashboardPage() {
  const user = await requireUser("/dashboard/pendapatan");
  const isEducator = user.role === "educator" || user.role === "admin";

  const [earnings, contributions, sales, kodeSaya, settings, handle] = await Promise.all([
    getMyEarnings(user.uid),
    getMyContributions(user.uid),
    isEducator ? getMySales(user.uid) : Promise.resolve(null),
    getMyReferralCode(user.uid),
    getPaymentSettings(),
    getUsernameInfo(user.uid),
  ]);

  return (
    <>
      <Navbar />

      <main className="bg-paper min-h-screen pt-36 pb-24">
        <div className="container-page">
          <Link href="/dashboard" className="mb-8 inline-block text-sm text-white/60 transition-colors hover:text-white">
            Kembali ke dashboard
          </Link>
          <h1 className="mb-4 text-[clamp(2.2rem,5vw,3.75rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
            Pendapatan
          </h1>
          <p className="t-body text-ink-muted mb-14 max-w-[62ch]">
            Bagian Anda dari setiap penjualan kursus yang Anda susun, ikut susun, atau promosikan lewat
            kode referral. Penarikan dana
            belum tersedia. Untuk sekarang, di sinilah pendapatan Anda tercatat.
          </p>

          {/* ── Pendapatan royalti ─────────────────────────────── */}
          <section className="mb-16">
            <SectionHead judul="Pendapatan Royalti" />

            <Stats
              items={[
                { nilai: formatPrice(earnings.total), label: "Total pendapatan" },
                { nilai: earnings.sales.toLocaleString("id-ID"), label: "Penjualan" },
                { nilai: earnings.courses.length.toLocaleString("id-ID"), label: "Kursus menghasilkan" },
              ]}
            />

            {earnings.rows.length === 0 ? (
              <Empty>
                Belum ada pendapatan. Setiap kali kursus tempat Anda tercantum sebagai kontributor
                terjual, bagian Anda muncul di sini.
              </Empty>
            ) : (
              <>
                {earnings.courses.length > 1 && (
                  <ul className="mt-8 divide-y divide-white/10 bg-paper-card">
                    {earnings.courses.map((c) => (
                      <li key={c.courseSlug} className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
                        <span className="min-w-0 break-words text-sm text-ink">{c.courseTitle}</span>
                        <span className="text-sm text-ink-muted">
                          {c.sales} penjualan · <span className="t-numeral text-ink">{formatPrice(c.total)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <Table
                  className="mt-8"
                  head={["Tanggal", "Kursus", "Peran", "Bagian", "Harga", "Potongan", "Pendapatan"]}
                  rows={earnings.rows.map((r) => [
                    formatDateOnly(r.saleAt),
                    r.courseTitle,
                    r.role === "owner" ? "Pemilik" : r.role === "referral" ? "Referral" : "Kontributor",
                    `${r.sharePercent}%`,
                    formatPrice(r.gross),
                    `${r.feePercent}%`,
                    <span key="a" className="t-numeral text-ink">{formatPrice(r.amount)}</span>,
                  ])}
                />
              </>
            )}
          </section>

          {/* ── Kode referral ─────────────────────────────────── */}
          <section id="referral" className="mb-16 scroll-mt-32">
            <SectionHead judul="Kode Referral" />
            <div className="bg-paper-card p-7 sm:p-9">
              <p className="t-body text-sm mb-6 max-w-[62ch]">
                Bagikan kursus mana pun - milik Anda atau orang lain - dengan kode Anda. Setiap kali
                seseorang membeli lewat kode itu, Anda mendapat{" "}
                <strong className="font-semibold text-ink">{settings.referralPercent}% dari harga kursus</strong>.
                Harga untuk pembeli tidak berubah.
              </p>

              {kodeSaya ? (
                <div className="flex flex-wrap items-end justify-between gap-6">
                  <div>
                    <p className="t-label text-ink-muted mb-2">Kode Anda</p>
                    <p className="t-numeral text-3xl tracking-wide text-ink">{kodeSaya}</p>
                    <p className="mt-3 text-xs text-ink-muted">
                      Buka halaman kursus mana pun lalu tekan <em>Bagikan dengan kode referral</em> -
                      kode Anda otomatis ikut di tautannya. Pembeli juga bisa mengetik kode ini saat membayar.
                    </p>
                  </div>
                  <dl className="text-right">
                    <dd className="t-numeral text-2xl text-ink">{formatPrice(earnings.referralTotal)}</dd>
                    <dt className="text-xs text-ink-muted">dari {earnings.referralSales} pembelian lewat kode Anda</dt>
                  </dl>
                </div>
              ) : (
                <ReferralCodeForm suggestion={suggestReferralCode(handle.username)} />
              )}
            </div>
          </section>

          {/* ── Kontribusi ─────────────────────────────────────── */}
          <section className="mb-16">
            <SectionHead judul="Kursus Tempat Anda Berkontribusi" />
            {contributions.length === 0 ? (
              <Empty>Anda belum tercantum sebagai kontributor di kursus mana pun.</Empty>
            ) : (
              <>
                <ul className="divide-y divide-white/10 bg-paper-card">
                  {contributions.map((c) => (
                    <li key={c.slug} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <Link href={`/courses/${c.slug}`} className="break-words text-sm text-ink hover:text-blue-700 transition-colors">
                          {c.title}
                        </Link>
                        {c.role === "owner" && <Tag tone="blue">Pemilik</Tag>}
                        {c.visibility === "private" && <Tag tone="neutral">Tersembunyi</Tag>}
                      </span>
                      <span className="t-numeral text-lg tabular-nums text-ink">{c.share}%</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-muted">
                  Persentase saat ini, berlaku untuk penjualan berikutnya. Penjualan yang sudah terjadi
                  memakai persentase pada saat pesanannya dibuat.
                </p>
              </>
            )}
          </section>

          {sales && <SalesSection sales={sales} />}
        </div>
      </main>

      <Footer />
    </>
  );
}

function SalesSection({ sales }: { sales: MySales }) {
  return (
    <section>
      <SectionHead judul="Penjualan Kursus Saya" aksi={{ href: "/educator/courses", label: "Kelola kursus" }} />

      <Stats
        items={[
          { nilai: formatPrice(sales.gross), label: "Penjualan kotor" },
          { nilai: formatPrice(sales.fee), label: "Potongan platform" },
          { nilai: formatPrice(sales.others), label: "Dibagikan ke kontributor" },
          { nilai: formatPrice(sales.owner), label: "Bagian Anda" },
        ]}
      />

      {sales.unallocated > 0 && (
        <p className="mt-4 bg-amber-500/15 px-4 py-3 text-sm text-warn-text">
          {formatPrice(sales.unallocated)} belum teralokasi karena syarat pembagiannya tidak terbaca.
          Admin akan meninjaunya.
        </p>
      )}

      {sales.rows.length === 0 ? (
        <Empty>Belum ada penjualan untuk kursus milik Anda.</Empty>
      ) : (
        <Table
          className="mt-8"
          head={["Tanggal", "Kursus", "Harga", "Potongan", "Pembagian"]}
          rows={sales.rows.map((r) => [
            formatDateOnly(r.saleAt),
            r.courseTitle,
            formatPrice(r.gross),
            `${formatPrice(r.feeAmount)} (${r.feePercent}%)`,
            <span key="p" className="block min-w-[14rem]">
              {r.lines.map((l, i) => (
                <span key={i} className="block">
                  {l.name} {l.share}% · <span className="t-numeral text-ink">{formatPrice(l.amount)}</span>
                </span>
              ))}
              {r.unallocatedAmount > 0 && (
                <span className="block text-warn-text">Belum teralokasi · {formatPrice(r.unallocatedAmount)}</span>
              )}
            </span>,
          ])}
        />
      )}
    </section>
  );
}

// ── Potongan tampilan ─────────────────────────────────────────────────

function SectionHead({ judul, aksi }: { judul: string; aksi?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="t-h3">{judul}</h2>
      {aksi && (
        <Link
          href={aksi.href}
          className="group inline-flex items-center gap-4 bg-white/[0.06] px-5 py-3 text-[11.5px] font-semibold uppercase tracking-[0.24em] text-white transition-colors duration-500 ease-warm hover:bg-blue-600"
        >
          {aksi.label}
          <span aria-hidden="true" className="flex items-center gap-2">
            <span className="h-px w-6 bg-white/40 transition-all duration-500 ease-warm group-hover:w-10 group-hover:bg-white" />
            <svg className="h-3.5 w-3.5 transition-transform duration-500 ease-warm group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </Link>
      )}
    </div>
  );
}

/** Satu kartu dibagi garis rambut — pola yang sama dengan angka profil. */
function Stats({ items }: { items: { nilai: string; label: string }[] }) {
  return (
    <dl className="grid gap-1 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
      {items.map((k) => (
        <div key={k.label} className="bg-paper-card px-7 py-6">
          <dd className="t-numeral text-[28px] tabular-nums text-ink break-words">{k.nilai}</dd>
          <dt className="mt-2 text-[12.5px] text-ink-muted">{k.label}</dt>
        </div>
      ))}
    </dl>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 bg-white/5 px-6 py-12 text-center text-sm text-ink-muted">
      {children}
    </p>
  );
}

/** Tabel lebar menggulir di dalam kotaknya sendiri, bukan menggeser halaman. */
function Table({
  head,
  rows,
  className,
}: {
  head: string[];
  rows: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto bg-paper-card ${className ?? ""}`}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10">
            {head.map((h) => (
              <th key={h} scope="col" className="t-label whitespace-nowrap px-5 py-3 font-medium text-ink-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="px-5 py-3 align-top text-ink-body">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
