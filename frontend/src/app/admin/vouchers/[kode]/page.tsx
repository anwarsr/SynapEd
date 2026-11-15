import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import VoucherForm, { VoucherKelola } from "@/components/admin/VoucherForm";
import BackLink from "@/components/ui/BackLink";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { adminBadges } from "@/lib/adminBadges";
import { formatDate } from "@/lib/adminUsers";
import { formatPrice } from "@/lib/courseUi";
import { requireAdmin } from "@/lib/firebase/session";
import { isLive, listOrdersWithVoucher } from "@/lib/orders";
import { getVoucher, listPemakaianVoucher, pilihanVoucher } from "@/lib/vouchers";
import { LABEL_STATUS, WARNA_STATUS, normalisasiKode, ringkasCakupan, ringkasPotongan, statusVoucher } from "@/lib/voucherRules";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ kode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kode } = await params;
  return { title: `Voucher ${normalisasiKode(decodeURIComponent(kode))} – Panel Admin SynapEd` };
}

const METODE: Record<string, string> = { midtrans: "Midtrans", manual: "QRIS manual", voucher: "Gratis (voucher)" };

export default async function AdminVoucherDetailPage({ params }: Props) {
  const { kode } = await params;
  const code = normalisasiKode(decodeURIComponent(kode));
  const admin = await requireAdmin(`/admin/vouchers/${code}`);
  const [badges, v, pemakaian, pesanan, pilihan] = await Promise.all([
    adminBadges(),
    getVoucher(code),
    listPemakaianVoucher(code),
    listOrdersWithVoucher(code),
    pilihanVoucher(),
  ]);
  if (!v) notFound();

  const now = new Date(pilihan.jamServer);
  const s = statusVoucher(v, now);
  const tertunda = pesanan.filter((o) => isLive(o, now)).length;
  const dibayar = pemakaian.reduce((n, p) => n + p.paid, 0);
  const judul = Object.fromEntries(pilihan.kursus.map((k) => [k.slug, k.title]));
  const label = Object.fromEntries(pilihan.kategori.map((k) => [k.slug, k.label]));

  const angka = [
    { label: "Dipakai", nilai: `${v.dipakai}${v.kuota !== null ? ` / ${v.kuota}` : ""}` },
    { label: "Menunggu bayar", nilai: String(tertunda) },
    { label: "Total potongan", nilai: formatPrice(v.totalPotongan) },
    { label: "Uang masuk", nilai: formatPrice(dibayar) },
  ];

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page space-y-8">
        <div>
          <Breadcrumb items={[{ label: "Voucher", href: "/admin/vouchers" }, { label: v.code }]} />
          <h1 className="mb-3 break-all text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">{v.code}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-2 text-ink-body">
              <span aria-hidden className={cn("h-2 w-2", WARNA_STATUS[s])} />
              {LABEL_STATUS[s]}
            </span>
            <span>
              {ringkasPotongan(v)} untuk {ringkasCakupan(v, judul, label)}
            </span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-1 lg:grid-cols-4">
          {angka.map((a) => (
            <div key={a.label} className="bg-paper-card px-6 py-5">
              <dt className="t-label text-ink-muted">{a.label}</dt>
              <dd className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{a.nilai}</dd>
            </div>
          ))}
        </dl>

        <VoucherKelola code={v.code} aktif={v.active} bisaHapus={v.dipakai === 0 && pemakaian.length === 0 && tertunda === 0} />

        <VoucherForm key={v.updatedAt} awal={v} kursus={pilihan.kursus} kategori={pilihan.kategori} />

        <section className="bg-paper-card p-6 sm:p-7">
          <h2 className="t-h3 mb-4">Riwayat pemakaian</h2>
          {pemakaian.length === 0 ? (
            <p className="text-sm text-ink-muted">Belum ada pembelian lunas yang memakai voucher ini.</p>
          ) : (
            <ul className="divide-y divide-rule text-sm">
              {pemakaian.map((p) => (
                <li key={p.orderId} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_8rem_10rem] sm:items-baseline">
                  <span className="min-w-0 truncate text-ink">{p.userName ?? "-"}</span>
                  <span className="min-w-0 truncate text-ink-body">{p.courseTitle}</span>
                  <span className="tabular-nums text-ink-body">
                    {p.paid === 0 ? "Gratis" : formatPrice(p.paid)}
                    <span className="block text-xs text-ink-muted">hemat {formatPrice(p.discount)}</span>
                  </span>
                  <span className="text-xs text-ink-muted">
                    {formatDate(p.at)}
                    <span className="block">{METODE[p.method] ?? p.method}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <BackLink href="/admin/vouchers">Kembali ke daftar voucher</BackLink>
      </div>
    </AdminShell>
  );
}
