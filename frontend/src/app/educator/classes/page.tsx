import Link from "next/link";
import EducatorShell from "@/components/educator/EducatorShell";
import ClassForm from "@/components/classes/ClassForm";
import { formatDate } from "@/lib/adminUsers";
import { listOwnedClasses } from "@/lib/classes";
import { requireEducator } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kelas Saya – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Daftar kelas milik educator, beserta formulir buatnya di halaman yang sama.
 *
 * Tanpa rute /baru tersendiri: membuat kelas hanya butuh dua kolom, dan
 * halaman terpisah untuk itu berarti satu perpindahan halaman penuh sebelum
 * sesuatu yang pertama kali dilihat orang justru kosong.
 */
export default async function MyClassesPage() {
  const user = await requireEducator("/educator/classes");
  const kelas = await listOwnedClasses(user.uid);

  return (
    <EducatorShell user={user}>
      <div className="container-reading">
        <p className="chapter-mark mb-5">
          <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
          <span>Educator</span>
        </p>

        <h1 className="t-h2 mb-3">
          Kelas <span className="mark">saya</span>
        </h1>

        <p className="t-body text-ink-muted mb-10">
          {kelas.length === 0
            ? "Belum ada kelas. Buat satu, lalu bagikan kode undangannya kepada peserta."
            : `${kelas.length} kelas.`}
        </p>

        <div className="mb-10">
          <ClassForm />
        </div>

        {kelas.length > 0 && (
          <ul className="space-y-3">
            {kelas.map((k) => (
              <li key={k.id} className="bg-paper-card border border-rule rounded-2xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/educator/classes/${k.id}`}
                      className="text-sm font-medium text-ink transition-colors duration-200 hover:text-blue-700"
                    >
                      {k.name}
                    </Link>

                    {k.description && (
                      <p className="mt-1 text-sm text-ink-muted line-clamp-2">{k.description}</p>
                    )}

                    <p className="mt-2 text-xs text-ink-muted">
                      {k.memberCount} anggota · {k.postCount} postingan · dibuat{" "}
                      {formatDate(k.createdAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Link
                      href={`/educator/classes/${k.id}`}
                      className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
                    >
                      Buka
                    </Link>
                    <Link
                      href={`/educator/classes/${k.id}/members`}
                      className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
                    >
                      Anggota
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </EducatorShell>
  );
}
