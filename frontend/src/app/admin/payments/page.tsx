import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ManualOrderDecision from "@/components/admin/ManualOrderDecision";
import PaymentSettingsForm from "@/components/admin/PaymentSettingsForm";
import PlatformFeeForm from "@/components/admin/PlatformFeeForm";
import { adminBadges } from "@/lib/adminBadges";
import { formatDate } from "@/lib/adminUsers";
import { formatPrice } from "@/lib/courseUi";
import { listOrdersAwaitingReview } from "@/lib/orders";
import { paymentsConfigured } from "@/lib/payments/midtrans";
import { getPaymentSettings } from "@/lib/paymentSettings";
import { requireAdmin } from "@/lib/firebase/session";
import { listPostPaidOrders, listUnallocatedSales } from "@/lib/royaltyDashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pembayaran – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const admin = await requireAdmin("/admin/payments");
  const [settings, orders, badges, unallocated, postPaid] = await Promise.all([
    getPaymentSettings(),
    listOrdersAwaitingReview(),
    adminBadges(),
    listUnallocatedSales(),
    listPostPaidOrders(),
  ]);

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page space-y-8">
        <div>
          <h1 className="t-h2 mb-3">
            Pembayaran <span className="mark">kursus</span>
          </h1>
          <p className="t-body text-ink-muted">
            {orders.length > 0
              ? `${orders.length} pembayaran QRIS menunggu Anda periksa.`
              : "Tidak ada pembayaran yang menunggu diperiksa."}
          </p>
        </div>

        <PaymentSettingsForm
          initial={{
            midtransEnabled: settings.midtransEnabled,
            manualQrisEnabled: settings.manualQrisEnabled,
            qrisImagePath: settings.qrisImagePath,
            qrisNote: settings.qrisNote,
          }}
          midtransConfigured={paymentsConfigured()}
        />

        <PlatformFeeForm initial={settings.platformFeePercent} />

        {/* ── Perlu tindak lanjut ─────────────────────────────────── */}
        {(unallocated.length > 0 || postPaid.length > 0) && (
          <section className="space-y-6">
            {postPaid.length > 0 && (
              <div className="bg-paper-card border border-rust-700/30 rounded-2xl p-7">
                <h2 className="t-h3 mb-1.5">Kabar gagal setelah lunas</h2>
                <p className="t-body text-sm text-ink-muted mb-5">
                  Midtrans mengirim status gagal untuk pesanan yang sudah lunas — biasanya refund atau
                  chargeback. Status dan pendapatan kontributor TIDAK diubah otomatis; periksa di
                  dashboard Midtrans lalu tindak lanjuti manual.
                </p>
                <ul className="divide-y divide-rule">
                  {postPaid.map((o) => (
                    <li key={o.orderId} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                      <span className="min-w-0 break-words text-ink">
                        {o.courseTitle}
                        <span className="block text-xs text-ink-muted break-all">{o.orderId}</span>
                      </span>
                      <span className="text-right text-ink-body">
                        {formatPrice(o.amount)} · <span className="text-rust-700">{o.postPaidTransactionStatus || o.postPaidStatus}</span>
                        <span className="block text-xs text-ink-muted">{formatDate(o.postPaidAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {unallocated.length > 0 && (
              <div className="bg-paper-card border border-amber-500/40 rounded-2xl p-7">
                <h2 className="t-h3 mb-1.5">Penjualan belum teralokasi</h2>
                <p className="t-body text-sm text-ink-muted mb-5">
                  Sebagian uang penjualan ini tidak punya penerima: kursusnya tanpa pemilik, atau
                  syarat pembagian di pesanannya tidak terbaca.
                </p>
                <ul className="divide-y divide-rule">
                  {unallocated.map((s) => (
                    <li key={s.orderId} className="flex flex-wrap items-baseline justify-between gap-3 py-3 text-sm">
                      <span className="min-w-0 break-words text-ink">
                        {s.courseTitle || s.courseSlug}
                        <span className="block text-xs text-ink-muted break-all">
                          {s.orderId} · {s.termsOrigin === "invalid" ? "syarat rusak" : "tanpa pemilik"}
                        </span>
                      </span>
                      <span className="text-right text-ink-body">
                        <span className="t-numeral text-amber-700">{formatPrice(s.unallocatedAmount)}</span> dari {formatPrice(s.gross)}
                        <span className="block text-xs text-ink-muted">{formatDate(s.saleAt)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="t-h3 mb-1.5">Menunggu Diperiksa</h2>

          {/* Peringatan ini bukan basa-basi. Tangkapan layar mutasi sangat
              mudah dipalsukan, dan satu-satunya bukti yang sah adalah uang
              yang benar-benar terlihat di aplikasi Pedagang Bima. */}
          <p className="t-body text-sm text-ink-muted mb-6">
            Cocokkan dengan mutasi di aplikasi Pedagang Bima sebelum menyetujui. Bukti yang
            diunggah pembeli hanya petunjuk — gambar bisa dipalsukan, mutasi tidak.
          </p>

          {orders.length === 0 ? (
            <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
              <p className="t-body text-ink-muted">
                Belum ada bukti bayar yang masuk.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((o) => (
                <li key={o.orderId} className="bg-paper-card border border-rule rounded-2xl p-6">
                  <div className="grid lg:grid-cols-[16rem_1fr] gap-6">
                    <div>
                      {/* Bukti disajikan lewat route yang memeriksa peran —
                          berkasnya sendiri tertutup di storage.rules. */}
                      <a
                        href={`/api/payments/proof?orderId=${encodeURIComponent(o.orderId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/payments/proof?orderId=${encodeURIComponent(o.orderId)}`}
                          alt={`Bukti bayar ${o.orderId}`}
                          className="w-full rounded-lg border border-rule bg-paper-alt object-contain max-h-72"
                        />
                      </a>
                      <p className="mt-2 text-xs text-ink-muted text-center">
                        Klik untuk membuka ukuran penuh
                      </p>
                    </div>

                    <div className="min-w-0">
                      <dl className="space-y-2 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <dt className="text-ink-muted">Nominal</dt>
                          <dd className="t-numeral text-lg text-ink">{formatPrice(o.amount)}</dd>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <dt className="text-ink-muted">Kursus</dt>
                          <dd className="text-right min-w-0">
                            <Link
                              href={`/courses/${o.courseSlug}`}
                              className="text-ink-body hover:text-blue-700 transition-colors break-words"
                            >
                              {o.courseTitle}
                            </Link>
                          </dd>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <dt className="text-ink-muted">Pembeli</dt>
                          <dd className="text-ink-body text-right break-all">
                            {o.userName ?? "—"}
                            {o.userEmail && (
                              <span className="block text-xs text-ink-muted">{o.userEmail}</span>
                            )}
                          </dd>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <dt className="text-ink-muted">Pesanan dibuat</dt>
                          <dd className="text-ink-body text-right">{formatDate(o.createdAt)}</dd>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-3">
                          <dt className="text-ink-muted">No. pesanan</dt>
                          <dd className="text-xs text-ink-muted text-right break-all">
                            {o.orderId}
                          </dd>
                        </div>
                      </dl>

                      {o.payerNote && (
                        <div className="mt-4 rounded-lg bg-paper-alt px-4 py-3">
                          <p className="t-label text-ink-muted mb-1">Catatan pembeli</p>
                          <p className="text-sm text-ink-body whitespace-pre-line break-words">
                            {o.payerNote}
                          </p>
                        </div>
                      )}

                      <ManualOrderDecision orderId={o.orderId} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
