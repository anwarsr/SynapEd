/**
 * Ilustrasi garis kecil untuk kartu galeri SynapLab — satu per materi.
 *
 * Warna hanya dari token lewat `currentColor` (`text-white/NN`, `text-blue-*`,
 * `text-ink`), jadi ikut tema gelap/terang/kustom tanpa hex: di tema terang
 * `--color-white` dibalik menjadi tinta gelap, dan garis netral ikut berbalik.
 * Server component (tanpa state), digambar di viewBox 240×140.
 */

const NETRAL = "text-white/35";
const HURUF = { fontFamily: "var(--font-sans)", fontWeight: 700 } as const;
const MONO = { fontFamily: "var(--font-mono, ui-monospace, monospace)" } as const;

export default function IlustrasiLab({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 240 140" className="h-full w-full" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {GAMBAR[id] ?? null}
    </svg>
  );
}

const GAMBAR: Record<string, React.ReactNode> = {
  array: (
    <>
      <g className={NETRAL} stroke="currentColor" strokeWidth={2}>
        <rect x={40} y={46} width={160} height={42} />
        {[80, 120, 160].map((x) => (
          <line key={x} x1={x} y1={46} x2={x} y2={88} />
        ))}
      </g>
      {["2", "5", "1"].map((v, i) => (
        <text key={i} x={60 + i * 40} y={74} textAnchor="middle" fontSize={18} style={HURUF} className="fill-current text-ink">
          {v}
        </text>
      ))}
      <rect x={121} y={47} width={38} height={40} className="fill-current text-blue-500/25" />
      {[0, 1, 2, 3].map((i) => (
        <text key={i} x={60 + i * 40} y={108} textAnchor="middle" fontSize={13} style={HURUF} className="fill-current text-blue-300">
          {i}
        </text>
      ))}
    </>
  ),

  linkedList: (
    <>
      <text x={22} y={42} fontSize={11} style={HURUF} className="fill-current text-blue-300">
        HEAD
      </text>
      <g className={NETRAL} stroke="currentColor" strokeWidth={2}>
        <rect x={22} y={52} width={22} height={22} />
        <rect x={70} y={52} width={52} height={30} />
        <line x1={104} y1={52} x2={104} y2={82} />
        <rect x={150} y={52} width={52} height={30} />
        <line x1={184} y1={52} x2={184} y2={82} />
        <line x1={186} y1={80} x2={200} y2={54} />
      </g>
      <text x={87} y={73} textAnchor="middle" fontSize={14} style={HURUF} className="fill-current text-ink">
        7
      </text>
      <text x={167} y={73} textAnchor="middle" fontSize={14} style={HURUF} className="fill-current text-ink">
        3
      </text>
      <g className="text-blue-400" stroke="currentColor" strokeWidth={2}>
        <circle cx={33} cy={63} r={3} className="fill-current" />
        <path d="M33 63 H66" />
        <path d="M61 58 L67 63 L61 68" />
        <circle cx={113} cy={67} r={3} className="fill-current" />
        <path d="M113 67 H146" />
        <path d="M141 62 L147 67 L141 72" />
      </g>
      <text x={70} y={102} fontSize={10} style={MONO} className="fill-current text-white/40">
        0x3F1
      </text>
      <text x={150} y={102} fontSize={10} style={MONO} className="fill-current text-white/40">
        0x7A4
      </text>
    </>
  ),

  flowchart: (
    <>
      <g className={NETRAL} stroke="currentColor" strokeWidth={2}>
        <rect x={92} y={10} width={56} height={22} rx={11} />
        <rect x={88} y={46} width={64} height={22} />
        <path d="M120 82 L146 98 L120 114 L94 98 Z" />
        <rect x={176} y={87} width={50} height={22} />
      </g>
      <g className="text-blue-400" stroke="currentColor" strokeWidth={2}>
        <path d="M120 32 V44" />
        <path d="M116 40 L120 45 L124 40" />
        <path d="M120 68 V80" />
        <path d="M116 76 L120 81 L124 76" />
        <path d="M146 98 H174" />
        <path d="M170 94 L175 98 L170 102" />
        <path d="M120 114 V130" />
      </g>
      <text x={120} y={25} textAnchor="middle" fontSize={9} style={HURUF} className="fill-current text-ink">
        START
      </text>
      <text x={120} y={61} textAnchor="middle" fontSize={9} style={HURUF} className="fill-current text-ink">
        INPUT X
      </text>
      <text x={160} y={93} fontSize={8} style={HURUF} className="fill-current text-blue-300">
        Yes
      </text>
    </>
  ),

  python: (
    <>
      <rect x={30} y={16} width={180} height={108} className={`${NETRAL}`} stroke="currentColor" strokeWidth={2} />
      <line x1={30} y1={32} x2={210} y2={32} className={NETRAL} stroke="currentColor" strokeWidth={2} />
      {[42, 52, 62].map((x) => (
        <circle key={x} cx={x} cy={24} r={2.5} className="fill-current text-white/35" />
      ))}
      <rect x={31} y={57} width={178} height={16} className="fill-current text-blue-500/20" />
      {[
        { y: 50, t: "for i in range(3):", c: "text-ink" },
        { y: 69, t: "    print(i * 2)", c: "text-ink" },
        { y: 88, t: ">>> 0", c: "text-blue-300" },
        { y: 104, t: ">>> 2", c: "text-blue-300" },
      ].map((b) => (
        <text key={b.y} x={42} y={b.y} fontSize={11} style={MONO} className={`fill-current ${b.c}`} xmlSpace="preserve">
          {b.t}
        </text>
      ))}
      <text x={34} y={69} fontSize={10} className="fill-current text-blue-300">
        ▸
      </text>
    </>
  ),

  pseudocode: (
    <>
      <rect x={30} y={16} width={180} height={108} className={NETRAL} stroke="currentColor" strokeWidth={2} />
      <rect x={31} y={58} width={178} height={16} className="fill-current text-blue-500/20" />
      {[
        { y: 38, k: "FOR", r: " i ← 1 TO N" },
        { y: 54, k: "", r: "  Total ← Total + i" },
        { y: 70, k: "NEXT", r: " i" },
        { y: 92, k: "OUTPUT", r: " Total" },
      ].map((b) => (
        <text key={b.y} x={40} y={b.y + 1} fontSize={11} style={MONO} xmlSpace="preserve">
          <tspan className="fill-current text-blue-300" fontWeight={700}>
            {b.k}
          </tspan>
          <tspan className="fill-current text-ink">{b.r}</tspan>
        </text>
      ))}
      <text x={40} y={112} fontSize={9} style={HURUF} className="fill-current text-white/40">
        Cambridge 9618
      </text>
    </>
  ),

  sorting: (
    <>
      {[38, 62, 30, 84, 52, 96, 108].map((h, i) => {
        const warna = i === 2 || i === 3 ? "text-blue-300" : i >= 5 ? "text-blue-600" : "text-white/25";
        return <rect key={i} x={38 + i * 24} y={120 - h} width={18} height={h} className={`fill-current ${warna}`} />;
      })}
      <text x={81} y={14} fontSize={10} style={HURUF} className="fill-current text-blue-300">
        j
      </text>
      <text x={101} y={14} fontSize={10} style={HURUF} className="fill-current text-blue-300">
        j+1
      </text>
      <line x1={30} y1={121} x2={210} y2={121} className={NETRAL} stroke="currentColor" strokeWidth={2} />
    </>
  ),

  searching: (
    <>
      {[3, 9, 12, 21, 27, 38, 43].map((v, i) => {
        const redup = i < 3;
        const tengah = i === 4;
        return (
          <g key={i} opacity={redup ? 0.35 : 1}>
            <rect x={22 + i * 28} y={58} width={24} height={24} className={`fill-current ${tengah ? "text-blue-300" : "text-white/10"}`} />
            {!redup && !tengah && <line x1={22 + i * 28} y1={83} x2={46 + i * 28} y2={83} className="text-blue-400" stroke="currentColor" strokeWidth={2} />}
            <text x={34 + i * 28} y={75} textAnchor="middle" fontSize={10} style={HURUF} className={`fill-current ${tengah ? "text-paper" : "text-ink"}`}>
              {v}
            </text>
          </g>
        );
      })}
      {/* Label tepat di atas/bawah kotaknya: pusat kotak ke-i = 34 + 28i. */}
      <text x={118} y={50} textAnchor="middle" fontSize={9} style={HURUF} className="fill-current text-blue-300">
        Kiri
      </text>
      <text x={202} y={50} textAnchor="middle" fontSize={9} style={HURUF} className="fill-current text-blue-300">
        Kanan
      </text>
      <text x={146} y={98} textAnchor="middle" fontSize={9} style={HURUF} className="fill-current text-blue-300">
        Tengah
      </text>
      <text x={120} y={124} textAnchor="middle" fontSize={10} style={HURUF} className="fill-current text-white/40">
        Cari 38
      </text>
    </>
  ),
};
