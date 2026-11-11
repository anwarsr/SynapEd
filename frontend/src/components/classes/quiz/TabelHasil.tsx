import { uraiJawabanTabel, type TabelSoal } from "@/lib/classQuizRules";

/**
 * Tabel pada halaman hasil (komponen SERVER, tanpa hook). Menampilkan jawaban siswa di tiap sel isian. Sel isian tidak
 * punya kunci jawaban: pengajar memeriksa jawabannya sendiri dan memberi poin, jadi tidak ada tanda benar/salah otomatis.
 */
export default function TabelHasil({
  tabel,
  jawab,
}: {
  tabel: TabelSoal;
  jawab: string | undefined;
}) {
  const j = uraiJawabanTabel(jawab);

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
                return (
                  <td key={c} className="min-w-[128px] whitespace-pre-line break-words bg-white/[0.06] px-3 py-2 align-top text-sm text-ink">
                    {diisi ? diisi : <span className="text-ink-muted">(kosong)</span>}
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
