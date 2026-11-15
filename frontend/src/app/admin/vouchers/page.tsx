import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { adminBadges } from "@/lib/adminBadges";
import { formatDate } from "@/lib/adminUsers";
import { formatPrice } from "@/lib/courseUi";
import { requireAdmin } from "@/lib/firebase/session";
import { pilihanVoucher, listVouchers } from "@/lib/vouchers";
import { LABEL_STATUS, WARNA_STATUS, ringkasCakupan, ringkasPotongan, statusVoucher } from "@/lib/voucherRules";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Voucher – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Daftar voucher potongan harga. Hanya admin yang membuat voucher (keputusan
 * pemilik); pembeli memasukkan kodenya di halaman kursus / Premium.
 */
export default async function AdminVouchersPage() {
  const admin = await requireAdmin("/admin/vouchers");
  const [badges, vouchers, pilihan] = await Promise.all([adminBadges(), listVouchers(), pilihanVoucher()]);
  // Satu jam untuk seluruh render (lint purity melarang Date.now() di komponen).
  const now = new Date(pilihan.jamServer);
  const judul = Object.fromEntries(pilihan.kursus.map((k) => [k.slug, k.title]));
  const label = Object.fromEntries(pilihan.kategori.map((k) => [k.slug, k.label]));
  const aktif = vouchers.filter((v) => statusVoucher(v, now) === "aktif").length;
  const total = vouchers.reduce((n, v) => n + v.totalPotongan, 0);

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">Voucher</h1>
            <p className="t-body text-ink-muted">
              {vouchers.length} voucher · {aktif} aktif · total potongan diberikan {formatPrice(total)}.
            </p>
          </div>
          <Link href="/admin/vouchers/new" className="bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
            Buat voucher
          </Link>
        </div>

        {vouchers.length === 0 ? (
          <p className="bg-paper-card p-7 text-sm text-ink-muted">Belum ada voucher. Buat yang pertama untuk memberi potongan ke kursus tertentu, kategori, semua kursus, atau Premium.</p>
        ) : (
          <ul className="divide-y divide-rule bg-paper-card">
            {vouchers.map((v) => {
              const s = statusVoucher(v, now);
              return (
                <li key={v.code}>
                  <Link
                    href={`/admin/vouchers/${v.code}`}
                    className="grid gap-x-6 gap-y-1.5 px-6 py-4 transition-colors hover:bg-card-hover sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_9rem_7rem] sm:items-center"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold tracking-wide text-ink">{v.code}</span>
                      <span className="block truncate text-xs text-ink-muted">{v.note || ringkasPotongan(v)}</span>
                    </span>
                    <span className="min-w-0 text-sm text-ink-body">
                      <span className="block">{ringkasPotongan(v)}</span>
                      <span className="block truncate text-xs text-ink-muted">Untuk {ringkasCakupan(v, judul, label)}</span>
                    </span>
                    <span className="text-xs text-ink-muted">
                      {v.berakhir ? `s.d. ${formatDate(v.berakhir)}` : "Tanpa batas waktu"}
                    </span>
                    <span className="flex items-center justify-between gap-3 text-sm sm:flex-col sm:items-end sm:gap-1">
                      <span className="inline-flex items-center gap-2 text-ink-body">
                        <span aria-hidden className={cn("h-2 w-2", WARNA_STATUS[s])} />
                        {LABEL_STATUS[s]}
                      </span>
                      <span className="text-xs tabular-nums text-ink-muted">
                        {v.dipakai}
                        {v.kuota !== null ? ` / ${v.kuota}` : ""} dipakai
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
