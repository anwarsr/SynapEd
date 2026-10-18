import { notFound } from "next/navigation";
import type { Metadata } from "next";
import EducatorShell from "@/components/educator/EducatorShell";
import BackLink from "@/components/ui/BackLink";
import SectionTitle from "@/components/sections/SectionTitle";
import WheelBoard from "@/components/classes/WheelBoard";
import { listClassMembers } from "@/lib/classes";
import { requireOwnedClass } from "@/lib/classGuards";
import { getUserCards } from "@/lib/userCards";
import { requireUser } from "@/lib/firebase/session";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Roda Pemilih – SynapEd" };

export const dynamic = "force-dynamic";

/** Penjaganya sama seperti halaman anggota: requireUser + requireOwnedClass (pemilik atau admin). */
export default async function ClassWheelPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/educator/classes/${id}/wheel`);

  const kelas = await requireOwnedClass(user, id);
  if (!kelas) notFound();

  const anggota = await listClassMembers(id);
  const kartu = await getUserCards(anggota.map((a) => a.uid));
  // Hanya NAMA yang dikirim ke klien - tanpa uid/email.
  const nama = anggota.map((a) => kartu.get(a.uid)?.name ?? "Peserta");

  return (
    <EducatorShell user={user}>
      <div className="container-page">
        <BackLink href={`/educator/classes/${id}`}>Kembali ke kelas</BackLink>
        <div className="mb-12 mt-8 flex flex-col items-center text-center">
          <SectionTitle as="h1" title="Roda Pemilih" />
        </div>
        <WheelBoard classId={id} namaKelas={kelas.name} anggota={nama} />
      </div>
    </EducatorShell>
  );
}
