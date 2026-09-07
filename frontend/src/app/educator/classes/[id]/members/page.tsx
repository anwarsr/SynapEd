import Link from "next/link";
import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import { formatDate } from "@/lib/adminUsers";
import { listClassMembers } from "@/lib/classes";
import { requireOwnedClass } from "@/lib/classGuards";
import { getUserCards } from "@/lib/userCards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Anggota Kelas – SynapEd" };

export const dynamic = "force-dynamic";

/** Penjaganya sama seperti halaman kelas: requireUser + requireOwnedClass. */
export default async function ClassMembersPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/educator/classes/${id}/members`);

  const kelas = await requireOwnedClass(user, id);
  if (!kelas) notFound();

  const anggota = await listClassMembers(id);

  // Nama & foto dari Auth, SEKALI untuk seluruh halaman — bukan satu
  // panggilan per baris.
  const kartu = await getUserCards(anggota.map((a) => a.uid));

  return (
    <EducatorShell user={user}>
      <div className="container-reading">
        <p className="chapter-mark mb-5">
          <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
          <span>Educator</span>
        </p>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <h1 className="t-h2">
            Anggota <span className="mark">{kelas.name}</span>
          </h1>
          <Link
            href={`/educator/classes/${id}`}
            className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
          >
            ← Kembali ke kelas
          </Link>
        </div>

        <p className="t-body text-ink-muted mb-10">
          {anggota.length === 0
            ? "Belum ada yang bergabung. Bagikan kode undangannya kepada peserta."
            : `${anggota.length} anggota.`}
        </p>

        {anggota.length === 0 ? (
          <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
            <p className="t-body text-ink-muted">
              Anggota akan muncul di sini begitu ada yang memakai kode undangannya.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {anggota.map((a) => {
              const orang = kartu.get(a.uid);
              const nama = orang?.name ?? "Peserta";

              return (
                <li
                  key={a.id}
                  className="bg-paper-card border border-rule rounded-2xl p-6 flex flex-wrap items-center gap-3"
                >
                  <ProfileLink uid={a.uid} name={nama} secondary className="shrink-0">
                    <UserAvatar name={nama} photoURL={orang?.photoURL ?? null} />
                  </ProfileLink>

                  <div className="min-w-0 flex-1">
                    <ProfileLink uid={a.uid} name={nama} className="text-sm font-medium text-ink">
                      {nama}
                    </ProfileLink>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Bergabung {formatDate(a.joinedAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </EducatorShell>
  );
}
