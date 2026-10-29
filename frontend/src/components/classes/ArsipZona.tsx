import Link from "next/link";
import ArsipButton from "@/components/classes/ArsipButton";
import DeleteButton from "@/components/classes/DeleteButton";
import Lampiran, { hrefLampiran } from "@/components/classes/Lampiran";
import TeksBertaut from "@/components/classes/TeksBertaut";
import { formatDate } from "@/lib/adminUsers";
import type { KelasPost } from "@/lib/classTypes";

/**
 * Zona Arsip di sisi kanan tab Pengumuman - HANYA dirender untuk pengelola
 * (pemanggil yang menjaganya). Isinya pengumuman & tugas yang diarsipkan,
 * masing-masing bisa dibuka (isi lengkap + lampiran), dipulihkan, atau dihapus.
 */
export default function ArsipZona({
  classId,
  basePath,
  posts,
}: {
  classId: string;
  basePath: string;
  posts: readonly KelasPost[];
}) {
  return (
    <section className="bg-paper-card p-6" aria-labelledby="arsip-judul">
      <div className="mb-4 flex items-center justify-between">
        <p id="arsip-judul" className="t-label text-ink-muted">
          Arsip
        </p>
        <span className="text-[13px] text-ink-muted">{posts.length}</span>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm leading-[1.7] text-ink-muted">
          Pengumuman atau tugas yang Anda arsipkan disimpan di sini. Siswa tidak melihatnya.
        </p>
      ) : (
        <ul className="space-y-2">
          {posts.map((p) => {
            const tugas = p.kind === "assignment";
            const judul = tugas ? p.title : p.body.split("\n")[0].slice(0, 70) || p.model3d?.title || "Pengumuman";
            return (
              <li key={p.id} className="bg-white/[0.05]">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">
                        {tugas ? "Tugas" : "Pengumuman"}
                      </span>
                      <span className="mt-0.5 block break-words text-sm font-semibold text-ink">{judul}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">{formatDate(p.createdAt)}</span>
                    </span>
                    <svg
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-ink-muted transition-transform duration-300 group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>

                  <div className="px-3 pb-3">
                    {p.body && (
                      <p className="whitespace-pre-line break-words text-[13.5px] leading-[1.7] text-ink-body">
                        <TeksBertaut teks={p.body} />
                      </p>
                    )}
                    {p.model3d && (
                      <p className="mt-2 text-xs text-ink-muted">
                        Objek 3D: <span className="text-ink">{p.model3d.title}</span>
                      </p>
                    )}
                    <Lampiran
                      className="mt-3 !grid-cols-1"
                      files={p.attachments}
                      hrefs={p.attachments.map((_, j) => hrefLampiran(classId, p.id, j))}
                    />
                    {tugas && (
                      <Link
                        href={`${basePath}/tugas/${p.id}`}
                        className="mt-3 inline-block text-xs font-semibold text-blue-700 hover:underline underline-offset-4"
                      >
                        Buka tugas &amp; nilai →
                      </Link>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
                      <ArsipButton classId={classId} postId={p.id} arsip />
                      <DeleteButton target={{ kind: "post", classId, postId: p.id }} />
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
