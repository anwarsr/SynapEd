import AdminShell from "@/components/admin/AdminShell";
import { PremiumGrantForm, PremiumPriceForm, SettleButton } from "@/components/admin/PremiumAdmin";
import { adminBadges } from "@/lib/adminBadges";
import { formatDate } from "@/lib/adminUsers";
import { formatPrice } from "@/lib/courseUi";
import { requireAdmin } from "@/lib/firebase/session";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { listAnggotaAktif, listPembagianTerakhir, listPeriodeSiapDibagi } from "@/lib/premium";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Premium – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

const SUMBER: Record<string, string> = { midtrans: "Midtrans", manual: "QRIS manual", admin: "Pemberian admin" };

/**
 * Panel SynapEd Premium: harga, beri/cabut, anggota aktif, dan pembagian hasil.
 *
 * App Hosting tidak punya penjadwal, jadi bagi hasil periode yang sudah
 * berakhir dipicu dari sini (atau skrip `settle-premium`). Keduanya idempoten.
 */
export default async function AdminPremiumPage() {
  const admin = await requireAdmin("/admin/premium");
  const [badges, settings, anggota, siap, riwayat] = await Promise.all([
    adminBadges(),
    getPaymentSettings(),
    listAnggotaAktif(),
    listPeriodeSiapDibagi(),
    listPembagianTerakhir(),
  ]);
  const totalSiap = siap.reduce((n, p) => n + p.gross, 0);

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page space-y-8">
        <div>
          <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">Premium</h1>
          <p className="t-body text-ink-muted">
            {anggota.length} anggota aktif · {siap.length} periode berakhir menunggu dibagikan ({formatPrice(totalSiap)}).
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PremiumPriceForm awal={settings.premiumPrice} />
          <PremiumGrantForm />
        </div>

        <section className="bg-paper-card p-7">
          <h2 className="t-h3 mb-1.5">Bagi hasil ke educator</h2>
          <p className="mb-5 text-sm text-ink-muted">
            Setiap periode 30 hari yang sudah berakhir: potongan platform {settings.platformFeePercent}% (perujuk dibayar dari potongan itu
            saat pembelian), sisanya dibagi ke kursus berbayar yang dipelajari anggota itu, sebanding dengan pelajaran yang ia selesaikan.
            Periode tanpa pemakaian menjadi milik platform. Hasilnya langsung tampil di halaman Pendapatan educator.
          </p>
          {siap.length > 0 && (
            <ul className="mb-5 divide-y divide-rule text-sm">
              {siap.slice(0, 10).map((p) => (
                <li key={p.periodId} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0 break-all text-ink-body">
                    {SUMBER[p.source] ?? p.source} <span className="text-xs text-ink-muted">· berakhir {formatDate(p.end)}</span>
                  </span>
                  <span className="tabular-nums text-ink">{formatPrice(p.gross)}</span>
                </li>
              ))}
            </ul>
          )}
          <SettleButton jumlah={siap.length} />
        </section>

        <section className="bg-paper-card p-7">
          <h2 className="t-h3 mb-4">Anggota aktif</h2>
          {anggota.length === 0 ? (
            <p className="text-sm text-ink-muted">Belum ada anggota premium aktif.</p>
          ) : (
            <ul className="divide-y divide-rule text-sm">
              {anggota.map((a) => (
                <li key={a.uid} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-ink">{a.nama}</span>
                    <span className="block break-all text-xs text-ink-muted">{a.email || a.uid}</span>
                  </span>
                  <span className="text-right text-ink-body">
                    sampai {formatDate(a.activeUntil)}
                    <span className="block text-xs text-ink-muted">{a.sisaHari} hari lagi</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {riwayat.length > 0 && (
          <section className="bg-paper-card p-7">
            <h2 className="t-h3 mb-4">Pembagian terakhir</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                    <th className="py-2 font-semibold">Periode berakhir</th>
                    <th className="py-2 text-right font-semibold">Bayar</th>
                    <th className="py-2 text-right font-semibold">Educator</th>
                    <th className="py-2 text-right font-semibold">Perujuk</th>
                    <th className="py-2 text-right font-semibold">Platform</th>
                    <th className="py-2 text-right font-semibold">Belum teralokasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule tabular-nums">
                  {riwayat.map((r) => (
                    <tr key={r.periodId}>
                      <td className="py-2.5 text-ink-body">
                        {formatDate(r.end)} <span className="text-xs text-ink-muted">· {r.kursus} kursus</span>
                      </td>
                      <td className="py-2.5 text-right text-ink">{formatPrice(r.gross)}</td>
                      <td className="py-2.5 text-right text-ink">{formatPrice(r.educatorAmount)}</td>
                      <td className="py-2.5 text-right text-ink-body">{formatPrice(r.referralAmount)}</td>
                      <td className="py-2.5 text-right text-ink-body">{formatPrice(r.platformAmount)}</td>
                      <td className={r.unallocatedAmount > 0 ? "py-2.5 text-right text-warn-text" : "py-2.5 text-right text-ink-muted"}>
                        {formatPrice(r.unallocatedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
