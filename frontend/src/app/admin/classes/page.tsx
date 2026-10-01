import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import UserAvatar from "@/components/ui/UserAvatar";
import ProfileLink from "@/components/ui/ProfileLink";
import DeleteButton from "@/components/classes/DeleteButton";
import { formatDate } from "@/lib/adminUsers";
import { listAllClasses } from "@/lib/classes";
import { getUserCards } from "@/lib/userCards";
import { adminBadges } from "@/lib/adminBadges";
import { requireAdmin } from "@/lib/firebase/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kelas – Admin SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Seluruh kelas di aplikasi ini, untuk dipantau dan dimoderasi admin.
 *
 * Kelas tidak melewati persetujuan siapa pun sebelum dipakai, jadi halaman ini
 * satu-satunya tempat sebuah kelas bermasalah bisa ditemukan tanpa menunggu
 * ada yang melapor.
 *
 * KODE UNDANGAN TIDAK DITAMPILKAN. Admin memang berhak membukanya lewat
 * halaman kelasnya, tetapi mendaftar seluruh kode di satu halaman berarti satu
 * layar yang membocorkan kunci setiap kelas sekaligus.
 */
export default async function AdminClassesPage() {
  const user = await requireAdmin("/admin/classes");

  const [kelas, badges] = await Promise.all([listAllClasses(), adminBadges()]);

  // Nama pemilik dibaca SEKALI untuk seluruh halaman.
  const kartu = await getUserCards(kelas.map((k) => k.ownerUid));

  return (
    <AdminShell user={user} badges={badges}>
      <div className="container-page">
        <p className="chapter-mark mb-5">
          <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
          <span>Admin</span>
        </p>

        <h1 className="t-h2 mb-3">
          Kelas <span className="mark">terdaftar</span>
        </h1>

        <p className="t-body text-ink-muted mb-10">
          {kelas.length === 0
            ? "Belum ada kelas. Kelas yang dibuat educator akan muncul di sini."
            : `${kelas.length} kelas.`}
        </p>

        {kelas.length === 0 ? (
          <div className="bg-paper-card border border-rule rounded-2xl p-12 text-center">
            <p className="t-body text-ink-muted">
              Kelas akan muncul di sini begitu ada educator yang membuatnya.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {kelas.map((k) => {
              const pemilik = kartu.get(k.ownerUid);
              const nama = pemilik?.name ?? "Educator";

              return (
                <li key={k.id} className="bg-paper-card border border-rule rounded-2xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{k.name}</p>

                      {k.description && (
                        <p className="mt-1 text-sm text-ink-muted line-clamp-2">
                          {k.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ProfileLink uid={k.ownerUid} name={nama} secondary className="shrink-0">
                          <UserAvatar
                            name={nama}
                            photoURL={pemilik?.photoURL ?? null}
                            size="sm"
                          />
                        </ProfileLink>
                        <ProfileLink
                          uid={k.ownerUid}
                          name={nama}
                          className="text-xs font-medium text-ink"
                        >
                          {nama}
                        </ProfileLink>
                        <span className="text-xs text-ink-muted">
                          · {k.memberCount} anggota · {k.postCount} postingan · dibuat{" "}
                          {formatDate(k.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <Link
                        href={`/educator/classes/${k.id}`}
                        className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors duration-200 hover:border-blue-500 hover:text-blue-700"
                      >
                        Buka
                      </Link>
                      <DeleteButton target={{ kind: "class", classId: k.id }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
