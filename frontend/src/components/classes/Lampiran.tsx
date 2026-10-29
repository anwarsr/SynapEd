import { ekstensiOf, type KelasBerkas } from "@/lib/classAssignmentRules";
import { formatBytes } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";

/** Warna lencana per jenis — selalu disertai teks ekstensinya, bukan warna saja. */
function nadaLencana(ext: string): string {
  if (ext === ".pdf") return "bg-rust-100 text-rust-700";
  if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") return "bg-amber-100 text-amber-700";
  if (ext === ".zip") return "bg-paper-alt text-ink-muted";
  return "bg-blue-50 text-blue-700";
}

/**
 * Daftar berkas sebagai kartu unduhan.
 *
 * Tanpa hook dan tanpa "use client", jadi bisa dirender dari komponen server
 * maupun klien. `hrefs` disusun pemanggil karena route penyajinya berbeda
 * untuk lampiran pengajar dan jawaban siswa — dan keduanya memeriksa hak
 * akses di server; tautan di sini bukan penjaga apa pun.
 */
export default function Lampiran({
  files,
  hrefs,
  className,
}: {
  files: readonly KelasBerkas[];
  hrefs: readonly string[];
  className?: string;
}) {
  if (files.length === 0) return null;

  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {files.map((f, i) => {
        const ext = ekstensiOf(f.name);
        return (
          <li key={f.path} className="min-w-0">
            <a
              href={hrefs[i]}
              className="group flex min-w-0 items-center gap-3 bg-white/[0.06] px-3 py-2.5 transition-colors duration-200 hover:bg-blue-50/40"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-9 w-11 shrink-0 items-center justify-center text-[10px] font-bold uppercase tracking-wide",
                  nadaLencana(ext),
                )}
              >
                {ext.replace(".", "") || "file"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink group-hover:text-blue-700">
                  {f.name}
                </span>
                <span className="block text-xs text-ink-muted">
                  {formatBytes(f.size) ?? "Berkas"} · Unduh
                </span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function hrefLampiran(classId: string, postId: string, i: number): string {
  return `/api/classes/attachment?class=${encodeURIComponent(classId)}&post=${encodeURIComponent(postId)}&i=${i}`;
}

export function hrefJawaban(submissionId: string, i: number): string {
  return `/api/classes/submission?id=${encodeURIComponent(submissionId)}&i=${i}`;
}
