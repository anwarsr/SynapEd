"use client";
import type { JenisSimpul } from "@/lib/lab/flowTypes";

/**
 * Tab "Panduan" flowchart: bentuk baku penulisan isi simbol.
 *
 * Bentuk baku = gaya Cambridge (silabus IGCSE 0478 / O Level 2210): silabus
 * itu menetapkan enam simbol flowchart dan meminta penulisan yang tepat, dan
 * isi simbolnya ditulis dalam pseudocode Cambridge yang sama dengan Lab 05.
 * Bentuk Indonesia tetap dijalankan — tabel "Juga diterima" di bawah — dan
 * tab Periksa menyarankan bentuk bakunya. Kalau mesin flowchart menerima
 * bentuk baru, tabel ini WAJIB ikut diperbarui (siswa hanya tahu yang tertulis).
 */

const KODE = "font-mono text-[12px] text-ink";

function K({ children }: { children: string }) {
  return <code className={KODE}>{children}</code>;
}

function Bagian({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="bg-paper-card p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">{judul}</h3>
      <div className="mt-2 text-sm leading-relaxed text-ink-body">{children}</div>
    </section>
  );
}

const SIMBOL: { jenis: JenisSimpul; nama: string; baku: string[]; ket: string }[] = [
  { jenis: "mulai", nama: "Terminator", baku: ["START", "STOP"], ket: "Awal dan akhir alur. Tepat satu START." },
  { jenis: "io", nama: "Input / Output", baku: ["INPUT X", 'OUTPUT "Luas = ", Luas'], ket: "Satu variabel per INPUT. Nilai OUTPUT disambung tanpa spasi: tulis spasinya di dalam teks." },
  { jenis: "proses", nama: "Process", baku: ["Total ← Total + X"], ket: "Penugasan, satu per baris. Ketik <- untuk menulis ←." },
  { jenis: "keputusan", nama: "Decision", baku: ["X > 0?", "Is X MOD 2 = 0?"], ket: "Kondisi benar/salah. Dua garis keluar berlabel Yes dan No (atau True dan False)." },
  { jenis: "subproses", nama: "Subroutine", baku: ["HitungLuas"], ket: "Nama prosedur yang digambar di flowchart terpisah. Dilewati saat dijalankan." },
];

export default function PanduanFlow({ Ikon }: { Ikon: (p: { jenis: JenisSimpul }) => React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-ink-body">
        Bentuk baku mengikuti <b className="text-ink">Cambridge</b> (IGCSE 0478 / O Level 2210): enam simbol standar, dan isinya
        ditulis tepat seperti pseudocode Cambridge, sama dengan Lab 05. Contohnya <K>X &gt; Y</K>, bukan &quot;X lebih dari Y&quot;.
        Bentuk Indonesia tetap bisa dijalankan; tab Periksa menyarankan bentuk bakunya.
      </p>

      <Bagian judul="Simbol & perintah">
        <ul className="flex flex-col gap-3">
          {SIMBOL.map((s) => (
            <li key={s.jenis} className="flex gap-3">
              <Ikon jenis={s.jenis} />
              <div className="min-w-0">
                <p className="font-semibold text-ink">{s.nama}</p>
                <p className="mt-0.5 flex flex-wrap gap-1.5">
                  {s.baku.map((b) => (
                    <code key={b} className="bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-ink">
                      {b}
                    </code>
                  ))}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{s.ket}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          Flow line: panah dari satu simbol ke simbol berikutnya. Persiapan, Konektor, Dokumen, Data tersimpan, dan Catatan adalah simbol
          ISO tambahan, tidak ada di daftar silabus Cambridge.
        </p>
      </Bagian>

      <Bagian judul="Operator & nilai">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          <dt className="text-ink-muted">Hitung</dt>
          <dd>
            <K>+ - * /</K>, <K>MOD</K> sisa bagi (<K>X MOD 2</K> atau <K>MOD(X, 2)</K>), <K>DIV</K> bagi bulat, <K>^</K> pangkat
          </dd>
          <dt className="text-ink-muted">Banding</dt>
          <dd>
            <K>=</K> sama dengan, <K>&lt;&gt;</K> tidak sama, <K>&lt; &gt; &lt;= &gt;=</K>
          </dd>
          <dt className="text-ink-muted">Logika</dt>
          <dd>
            <K>AND</K>, <K>OR</K>, <K>NOT</K>
          </dd>
          <dt className="text-ink-muted">Nilai</dt>
          <dd>
            angka <K>3.5</K>, teks <K>&quot;halo&quot;</K> (disambung dengan <K>&amp;</K>), <K>TRUE</K> / <K>FALSE</K>
          </dd>
          <dt className="text-ink-muted">Fungsi</dt>
          <dd>
            <K>INT(X)</K> <K>ROUND(X, 2)</K> <K>LENGTH(S)</K> <K>UCASE(S)</K> <K>LCASE(S)</K>; juga <K>abs</K> <K>min</K> <K>max</K> <K>akar</K>
          </dd>
        </dl>
      </Bagian>

      <Bagian judul="Juga diterima (bentuk lama)">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-muted">
              <th className="pb-1 font-normal">Ditulis</th>
              <th className="pb-1 font-normal">Bentuk baku</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {[
              ["Baca, Input, Read", "INPUT"],
              ["Tampilkan, Cetak, Print (nilai dipisah spasi)", "OUTPUT"],
              ["x = 1, :=, +=, ++", "←"],
              ["==, !=, ≠", "=, <>"],
              ["dan, atau, tidak, &&, ||, !", "AND, OR, NOT"],
              ["mod, %, div", "MOD, DIV"],
              ["benar, salah", "TRUE, FALSE"],
              ["Ya / Tidak, Y / T", "Yes / No"],
              ["Mulai / Selesai", "START / STOP"],
            ].map(([lama, baku]) => (
              <tr key={lama} className="border-t border-white/5">
                <td className="py-1 pr-2 font-mono text-ink-body">{lama}</td>
                <td className="py-1 font-mono text-ink">{baku}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bagian>

      <Bagian judul="Kesalahan yang sering terjadi">
        <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed">
          <li>
            <K>X &gt; MOD 2 = 0?</K> memuat dua operator berurutan. Yang benar <K>X MOD 2 = 0?</K>.
          </li>
          <li>
            Kalimat biasa seperti &quot;jika X lebih dari 5&quot; tidak bisa dijalankan. Tulis <K>X &gt; 5?</K>.
          </li>
          <li>INPUT/OUTPUT ditaruh di simbol jajar genjang (Input / Output), bukan di Process.</li>
          <li>Setiap Decision harus punya tepat dua garis keluar: satu Yes, satu No.</li>
        </ul>
      </Bagian>
    </div>
  );
}
