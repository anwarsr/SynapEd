import { skorTabel, uraiJawabanTabel, type TabelSoal } from "@/lib/classQuizRules";
import { cn } from "@/lib/cn";

/**
 * Tabel pada halaman hasil (komponen SERVER, tanpa hook). Menampilkan jawaban siswa di tiap sel isian.
 *
 * `tampilkanKunci` hanya true setelah quiz DITUTUP pengajar (aturan yang sama dengan pilihan ganda); saat itu tiap
 * sel diberi tanda benar/salah dan kunci sel yang salah dibuka. Selama false, `tabel.cells[].key` tidak dibaca
 * sama sekali - tabel dari komponen induk memang memuat kunci, jadi inilah satu-satunya penjaganya.
 */
export default function TabelHasil({
  tabel,
  jawab,
  tampilkanKunci,
}: {
  tabel: TabelSoal;
  jawab: string | undefined;
  tampilkanKunci: boolean;
}) {
  const j = uraiJawabanTabel(jawab);
  const skor = tampilkanKunci ? skorTabel(tabel, jawab) : null;

  return (
    <div className="mt-3 overflow-x-auto pb-1">
      <table className="w-full border-separate border-spacing-[3px]">
        <tbody>
          {Array.from({ length: tabel.rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: tabel.cols }, (_, c) => {
                const i = r * tabel.cols + c;
                const sel = tabel.cells[i];
                if (!sel.fill) {
                  return (
                    <td key={c} className="min-w-[96px] whitespace-pre-line break-words bg-white/[0.11] px-3 py-2.5 text-sm font-semibold text-ink">
                      {sel.text}
                    </td>
                  );
                }
                const diisi = j[i];
                const benar = skor?.perSel[i] === true;
                return (
                  <td
                    key={c}
                    className={cn(
                      "min-w-[128px] break-words px-3 py-2 align-top text-sm",
                      skor ? (benar ? "bg-blue-600/25 text-ink" : "bg-white/[0.05] text-ink-body shadow-[inset_0_-2px_0_var(--color-rust-700)]") : "bg-white/[0.06] text-ink",
                    )}
                  >
                    {diisi ? diisi : <span className="text-ink-muted">(kosong)</span>}
                    {skor && (
                      <span className={cn("mt-1 block text-[11px] font-semibold uppercase tracking-[0.14em]", benar ? "text-blue-300" : "text-rust-700")}>
                        {benar ? "Benar" : `Kunci: ${sel.key}`}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
