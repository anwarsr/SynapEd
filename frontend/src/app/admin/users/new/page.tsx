import AdminShell from "@/components/admin/AdminShell";
import CreateAccountForm from "@/components/admin/CreateAccountForm";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { adminBadges } from "@/lib/adminBadges";
import { requireAdmin } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buat Akun – Panel Admin SynapEd" };

export const dynamic = "force-dynamic";

export default async function NewAccountPage() {
  const admin = await requireAdmin("/admin/users/new");
  const badges = await adminBadges();

  return (
    <AdminShell user={admin} badges={badges}>
      <div className="container-reading">
        <Breadcrumb items={[{ label: "Akun Pengguna", href: "/admin" }, { label: "Buat akun" }]} />

        <h1 className="mb-4 text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">Buat akun</h1>
        <p className="t-body mb-10 max-w-[56ch] text-ink-muted">
          Akun email + kata sandi dengan role pilihan Anda. Pemiliknya bisa langsung masuk dengan data ini.
        </p>

        <CreateAccountForm />
      </div>
    </AdminShell>
  );
}
