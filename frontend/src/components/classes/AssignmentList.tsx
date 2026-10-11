import Link from "next/link";
import Tag from "@/components/ui/Tag";
import {
  LABEL_STATUS,
  formatWib,
  lewatTenggat,
  statusTugas,
  type KelasSubmission,
} from "@/lib/classAssignmentRules";
import type { KelasPost } from "@/lib/classTypes";

export type SudutTugas =
  | { peran: "siswa"; milikku: ReadonlyMap<string, Pick<KelasSubmission, "status" | "late" | "grade">> }
  | { peran: "pengajar"; hitungan: ReadonlyMap<string, { kumpul: number; dinilai: number }>; anggota: number };

/**
 * Daftar tugas satu kelas (tab "Tugas").
 *
 * Siswa melihat status MILIKNYA sendiri; pengajar melihat hitungan
 * terkumpul/dinilai. Keduanya dihitung di server oleh halaman pemanggil —
 * daftar ini tidak pernah menerima pengumpulan siswa lain di sisi siswa.
 */
export default function AssignmentList({
  posts,
  basePath,
  sudut,
  saat,
}: {
  posts: readonly KelasPost[];
  basePath: string;
  sudut: SudutTugas;
  /** Jam server saat halaman dirender — satu nilai untuk seluruh daftar. */
  saat: number;
}) {
  const tugas = posts.filter((p) => p.kind === "assignment" && p.assignment);

  if (tugas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-rule-strong bg-paper-card/55 px-8 py-14 text-center">
        <p className="text-[22px] font-medium text-ink">Belum ada tugas</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
          {sudut.peran === "pengajar"
            ? "Pilih “Tugas” di kotak tulis pada tab Pengumuman untuk menerbitkan tugas pertama."
            : "Tugas dari pengajar akan muncul di sini."}
        </p>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-rule bg-paper-card divide-y divide-rule">
      {tugas.map((post) => {
        const p = post.assignment!;
        const lewat = lewatTenggat(p.dueAt, saat);

        let kanan: React.ReactNode;
        if (sudut.peran === "siswa") {
          const sub = sudut.milikku.get(post.id) ?? null;
          const status = statusTugas(sub, p, saat);
          kanan = (
            <span className="flex flex-col items-end gap-1">
              <Tag tone={LABEL_STATUS[status].tone}>{LABEL_STATUS[status].label}</Tag>
              {sub?.status === "graded" && sub.grade !== null && (
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {sub.grade}/{p.maxPoints}
                </span>
              )}
            </span>
          );
        } else {
          const h = sudut.hitungan.get(post.id) ?? { kumpul: 0, dinilai: 0 };
          kanan = (
            <span className="text-right text-xs text-ink-muted">
              <span className="block text-[17px] font-medium tabular-nums text-ink">
                {h.kumpul}/{sudut.anggota}
              </span>
              terkumpul · {h.dinilai} dinilai
            </span>
          );
        }

        return (
          <li key={post.id}>
            <Link
              href={`${basePath}/tugas/${post.id}`}
              className="flex items-center gap-4 px-6 py-4 transition-colors duration-200 hover:bg-paper"
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{post.title}</span>
                <span className={lewat ? "block text-xs text-rust-700" : "block text-xs text-ink-muted"}>
                  {p.dueAt ? `Tenggat ${formatWib(p.dueAt)}` : "Tanpa tenggat"}
                  {lewat && (p.acceptLate ? " · masih menerima terlambat" : " · ditutup")}
                </span>
              </span>
              <span className="shrink-0">{kanan}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
