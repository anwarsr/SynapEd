import { ekstensiOf, mimeTampil, type KelasBerkas } from "@/lib/classAssignmentRules";
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
 * Daftar berkas sebagai kartu: PDF, gambar, dan teks dibuka langsung (tab baru), sisanya diunduh.
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
        // PDF/gambar/teks dibuka langsung di tab baru; sisanya (Office, ZIP) hanya bisa diunduh.
        const bisaLihat = mimeTampil(f.name) !== null;
        return (
          <li key={f.path} className="flex min-w-0 items-stretch gap-px bg-white/[0.06] transition-colors duration-200 hover:bg-blue-50/40">
            <a
              href={bisaLihat ? `${hrefs[i]}&lihat=1` : hrefs[i]}
              {...(bisaLihat ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5"
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
                  {formatBytes(f.size) ?? "Berkas"} · {bisaLihat ? "Buka" : "Unduh"}
                </span>
              </span>
            </a>
            {bisaLihat && (
              <a
                href={hrefs[i]}
                aria-label={`Unduh ${f.name}`}
                title="Unduh"
                className="flex shrink-0 items-center px-3 text-xs font-semibold text-ink-muted transition-colors duration-200 hover:text-blue-700"
              >
                Unduh
              </a>
            )}
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
