import AdminShell from "@/components/admin/AdminShell";
import VoucherForm from "@/components/admin/VoucherForm";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { adminBadges } from "@/lib/adminBadges";
import { requireAdmin } from "@/lib/firebase/session";
import { pilihanVoucher } from "@/lib/vouchers";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buat Voucher – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

export default async function NewVoucherPage() {
  const admin = await requireAdmin("/admin/vouchers/new");
  const [badges, pilihan] = await Promise.all([adminBadges(), pilihanVoucher()]);

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-page">
        <Breadcrumb items={[{ label: "Voucher", href: "/admin/vouchers" }, { label: "Buat voucher" }]} />
        <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">Buat voucher</h1>
        <p className="t-body mb-10 max-w-[60ch] text-ink-muted">
          Atur potongan, untuk apa voucher berlaku, masa berlakunya, dan siapa yang boleh memakainya. Pembeli memasukkan kodenya saat membeli.
        </p>
        <VoucherForm kursus={pilihan.kursus} kategori={pilihan.kategori} />
      </div>
    </AdminShell>
  );
}
