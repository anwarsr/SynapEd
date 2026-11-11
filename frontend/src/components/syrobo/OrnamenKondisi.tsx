import type { ReactNode } from "react";

/**
 * Ornamen kondisi robot (kotor & lapar), dipakai SyRobo dan robot asisten. Digambar "tangan": bentuk tak simetris,
 * ketebalan tak seragam (isian + sorotan), bukan elips/lingkaran polos. Semua bentuk dirancang di sekitar titik asal
 * (0,0) dengan lebar kira-kira 12 satuan, lalu diskalakan lewat `s` dan diletakkan lewat `x`,`y`.
 * `garis` = warna garis tinta (SyRobo bergaya stiker bergaris; robot asisten polos tanpa garis).
 */

function Taruh({ x, y, s = 1, r = 0, children }: { x: number; y: number; s?: number; r?: number; children: ReactNode }) {
  return <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>{children}</g>;
}

/** Noda lumpur: bercak tak beraturan + bayangan tepi + sorotan basah + percikan kecil. */
export function NodaLumpur({ x, y, s = 1, r = 0, garis }: { x: number; y: number; s?: number; r?: number; garis?: string }) {
  return (
    <Taruh x={x} y={y} s={s} r={r}>
      {/* dipipihkan: bercak yang menempel di badan, bukan gundukan */}
      <g transform="scale(1 0.6)">
      <path
        d="M-9 1C-10-4-4-8 1-6.5C5-9 11-5 10.5 0C13 3 9 8 4 7.2C0 10-7 9-8 5C-10 4-9.5 2-9 1Z"
        fill="#7A5B3A"
        stroke={garis}
        strokeWidth={garis ? 1.3 / s : 0}
        strokeLinejoin="round"
        opacity={0.92}
      />
      <path d="M-5 3C-3 5 2 6 6 4C4 7-3 8-6 5Z" fill="#5A4129" opacity={0.7} />
      <path d="M-5.5 0.5C-3.5-.8 0-1.2 2.5-.6C0 0-3 .8-5.5 0.5Z" fill="#B58C5E" opacity={0.6} />
      <path d="M12 6c1.6-.4 2.8.6 2.4 1.9c-.4 1.2-2.2 1.3-2.8.3c-.4-.8-.2-1.7.4-2.2Z" fill="#7A5B3A" />
      <path d="M-12-3c1.2-.6 2.4 0 2.2 1.1c-.2 1-1.7 1.3-2.3.5c-.3-.6-.2-1.2.1-1.6Z" fill="#7A5B3A" />
      </g>
    </Taruh>
  );
}

/** Awan bau: tiga ikal naik berlainan tinggi, warnanya hijau kekuningan pucat. */
export function BauBusuk({ x, y, s = 1, warna = "#9BA85A" }: { x: number; y: number; s?: number; warna?: string }) {
  return (
    <Taruh x={x} y={y} s={s}>
      <g fill="none" stroke={warna} strokeLinecap="round" strokeLinejoin="round" className="syrobo-bau">
        <path d="M-6 0C-9-3-3-6-6-10C-9-14-4-16-6-20" strokeWidth={1.7} />
        <path d="M1 1C-2-3 4-6 1-11C-1-15 3-17 1-22" strokeWidth={2.1} opacity={0.85} />
        <path d="M8 0C5-3 10-6 8-9C6-12 9-14 8-17" strokeWidth={1.5} opacity={0.7} />
      </g>
    </Taruh>
  );
}

/** Lalat: badan beruas, dua sayap bening ber-urat, kaki, mata merah; terbang menempuh jejak putus-putus. */
export function Lalat({ x, y, s = 1, r = 0, garis, jejak = true }: { x: number; y: number; s?: number; r?: number; garis?: string; jejak?: boolean }) {
  const tinta = garis ?? "#4B5560";
  return (
    <g className="syrobo-lalat">
      {jejak && <path d={`M${x - 16 * s} ${y + 7 * s}C${x - 11 * s} ${y - 3 * s} ${x - 6 * s} ${y + 9 * s} ${x - 1.5 * s} ${y + 1.5 * s}`} fill="none" stroke={tinta} strokeWidth={0.9 * s} strokeDasharray={`${1.2 * s} ${2.6 * s}`} strokeLinecap="round" opacity={0.45} />}
      <Taruh x={x} y={y} s={s} r={r}>
        {/* kaki */}
        <g stroke="#2A2520" strokeWidth={0.7} strokeLinecap="round" fill="none">
          <path d="M-1 2.2L-3 5.2L-2 6.6M0.6 2.5L0.4 5.8L1.6 7M2.2 2.2L4.2 4.6L5.4 4.4" />
        </g>
        {/* sayap bening, mengepak */}
        <g className="syrobo-sayap" stroke={tinta} strokeWidth={0.6} strokeLinejoin="round">
          <path d="M-0.5-0.8C-2-7-9-8.6-10.2-4.4C-10.8-1.4-5-.2-0.5-0.8Z" fill="#DDEFF7" fillOpacity={0.8} />
          <path d="M-2-1.8C-4-3.6-6.6-4.2-8.6-3.6" fill="none" strokeWidth={0.4} />
          <path d="M1.2-1C3.2-7.2 10-8.2 11-3.8C11.4-1 6-.2 1.2-1Z" fill="#DDEFF7" fillOpacity={0.8} />
          <path d="M2.4-1.8C4.2-3.4 6.8-3.8 8.8-3.2" fill="none" strokeWidth={0.4} />
        </g>
        {/* badan: perut beruas + dada + kepala */}
        <path d="M-2.2 0.6C-2.6 3.4 0.2 5.4 3.4 4.4C5.6 3.6 5.4 0.4 3.2-0.2C1-0.9-1.8-0.9-2.2 0.6Z" fill="#2E2823" stroke={garis} strokeWidth={garis ? 0.8 : 0} />
        <path d="M0.2 1.2C1.4 2 2.8 2.2 4 1.8M0.4 3C1.6 3.6 2.8 3.6 3.8 3.2" fill="none" stroke="#6A6058" strokeWidth={0.4} />
        <path d="M-4.2-0.4C-4.6 1.8-2.6 2.8-1 1.8C0 1-.3-.8-1.6-1.2C-2.6-1.5-4-1.4-4.2-.4Z" fill="#3B322B" stroke={garis} strokeWidth={garis ? 0.7 : 0} />
        <circle cx="-4.6" cy="0" r="1.15" fill="#B23A3A" />
        <circle cx="-5" cy="-.35" r="0.35" fill="#fff" opacity={0.85} />
        <path d="M0.4 0.4C1 .1 2 .1 2.6 .5" fill="none" stroke="#7C736A" strokeWidth={0.4} />
      </Taruh>
    </g>
  );
}

/** Air liur menetes dari ujung mulut: tetes berbentuk buah pir + sorotan + untaian tipis dari bibir. */
export function AirLiur({ x, y, s = 1, garis }: { x: number; y: number; s?: number; garis?: string }) {
  return (
    <Taruh x={x} y={y} s={s}>
      <g className="syrobo-liur">
        <path d="M0 -1.5C-.5 2-.2 4 0 5.4" fill="none" stroke="#BFE3F2" strokeWidth={1} strokeLinecap="round" opacity={0.9} />
        <path
          d="M0 4C-1.8 6.6-3.4 8.4-3.1 10.6C-2.8 12.7-1 13.6 0.4 13.5C2.2 13.4 3.4 11.8 3.1 10C2.8 8-.9 6.4 0 4Z"
          fill="#CDEAF6"
          stroke={garis ?? "#6FA3BD"}
          strokeWidth={garis ? 1.3 / s : 0.6}
          strokeLinejoin="round"
        />
        <path d="M-1.4 9.2C-1.6 10.2-1.2 11-0.5 11.4" fill="none" stroke="#fff" strokeWidth={0.9} strokeLinecap="round" />
      </g>
    </Taruh>
  );
}

/** Gemuruh perut: tiga goresan patah-patah berbeda panjang & tebal, seperti coretan komik. */
export function GemuruhPerut({ x, y, s = 1, arah = 1, warna = "#E0833B" }: { x: number; y: number; s?: number; arah?: 1 | -1; warna?: string }) {
  return (
    <Taruh x={x} y={y} s={s}>
      <g transform={`scale(${arah} 1)`} fill="none" stroke={warna} strokeLinecap="round" strokeLinejoin="round" className="syrobo-kruyuk">
        <path d="M0 0L3.4-2.6L1.6 1.6L5.6-1" strokeWidth={2.1} />
        <path d="M2.2 6.4L5.8 4.6L4.4 8.2L8.4 6.4" strokeWidth={1.6} opacity={0.85} />
        <path d="M-.6-6.4L1.8-8L1-4.8L3.6-6" strokeWidth={1.3} opacity={0.7} />
      </g>
    </Taruh>
  );
}
