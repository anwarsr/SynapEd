import type { ReactNode, Ref } from "react";

/**
 * Wajah SyRobo di layar kepalanya (kotak gelap x 54..146, y 58..116): mata menyala bergradasi dengan pupil & dua sorot, alis tipis
 * berwarna terang (BUKAN merah), kelopak, pipi merona lembut, serta detail kecil per perasaan (tetes keringat, gelembung ingus saat
 * tidur, tanda kesal berwarna kuning). Tiap perasaan punya bentuk mata, alis, dan mulutnya sendiri, supaya terbaca jelas walau kecil.
 * Hanya menggambar: pemilihan ekspresi ada di SyroboRobot. `mataRef` = kelompok mata (digeser melirik kursor).
 */

export type Ekspresi =
  | "normal"
  | "senang"
  | "makan"
  | "mandi"
  | "lapar"
  | "kotor"
  | "laparKotor"
  | "kaget"
  | "sayu"
  | "tidur"
  | "tidurSenang"
  | "tidurMarah"
  | "mati";

const LAYAR = "#2B3350";
const ALIS = "#CDEFFF";
const MULUT = "#BFE7F5";
const GELAP = "#14223F";
const KY = 84; // garis tengah mata

interface Kelopak {
  /** y garis kelopak atas di tepi LUAR dan tepi DALAM mata (menentukan miring: murung, kesal, mengantuk). */
  luar: number;
  dalam: number;
}

/** Mata robot AI: kapsul LED cyan polos yang menyala (tanpa pupil, sorot, atau gradasi), dengan kelopak datar yang bisa dimiringkan. */
function Mata({ id, cx, sisi, rx = 8.5, ry = 11, kelopak }: { id: string; cx: number; sisi: -1 | 1; rx?: number; ry?: number; kelopak?: Kelopak }) {
  const lebar = rx + 4;
  const xLuar = cx + sisi * lebar;
  const xDalam = cx - sisi * lebar;
  return (
    <g strokeWidth={0}>
      <ellipse cx={cx} cy={KY} rx={rx + 6} ry={ry + 6} fill={`url(#${id}-glow)`} />
      <rect x={cx - rx} y={KY - ry} width={rx * 2} height={ry * 2} rx={rx} fill="#8FE8FF" />
      {kelopak && <path d={`M${xLuar} ${KY - ry - 6}L${xDalam} ${KY - ry - 6}L${xDalam} ${kelopak.dalam}L${xLuar} ${kelopak.luar}Z`} fill={LAYAR} />}
    </g>
  );
}

/** Mata terpejam berbentuk busur (senang "^", lelap "u"): satu goresan bersih. */
function Busur({ d, tebal = 5 }: { d: string; tebal?: number }) {
  return <path d={d} stroke={MULUT} strokeWidth={tebal} fill="none" strokeLinecap="round" />;
}

function Alis({ kiri, kanan, tebal = 3.2, o = 0.9 }: { kiri: string; kanan: string; tebal?: number; o?: number }) {
  return (
    <g fill="none" stroke={ALIS} strokeWidth={tebal} strokeLinecap="round" opacity={o}>
      <path d={kiri} />
      <path d={kanan} />
    </g>
  );
}

function Pipi({ o, besar = 1 }: { o: number; besar?: number }) {
  return (
    <g strokeWidth={0} opacity={o}>
      <ellipse cx="66" cy="101" rx={9.5 * besar} ry={5.6 * besar} fill="url(#pipi)" />
      <ellipse cx="134" cy="101" rx={9.5 * besar} ry={5.6 * besar} fill="url(#pipi)" />
    </g>
  );
}

function Keringat({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    // Posisi di <g> luar (atribut transform), animasi di <g> dalam: transform CSS pada elemen SVG MENIMPA atribut transform-nya,
    // dan dulu itu membuat tetesnya lepas dari wajah dan melayang di pojok kiri atas robot.
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={0}>
      <g className="syrobo-keringat">
        <path d="M0 -6C0 -6 -5 0 -5 3.6a5 5 0 0010 0C5 0 0 -6 0 -6z" fill="#A8E6FF" stroke="#E8FAFF" strokeWidth={1} />
        <circle cx="-1.6" cy="2.2" r="1.3" fill="#fff" opacity={0.85} />
      </g>
    </g>
  );
}

export default function WajahRobot({ ekspresi, mataRef, uid, berkedip = false }: { ekspresi: Ekspresi; mataRef?: Ref<SVGGElement>; uid: string; berkedip?: boolean }) {
  const id = `${uid}-w`;
  const defs = (
    <defs>
      <radialGradient id={`${id}-glow`}>
        <stop offset="0.45" stopColor="#8FE8FF" stopOpacity="0.32" />
        <stop offset="1" stopColor="#8FE3FF" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="pipi">
        <stop offset="0" stopColor="#FF8FA0" stopOpacity="0.95" />
        <stop offset="1" stopColor="#FF8FA0" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
  const L = 79;
  const R = 121;
  let mata: ReactNode;
  let alis: ReactNode = null;
  let mulut: ReactNode = null;
  let pipi: ReactNode = <Pipi o={0.5} />;
  let ekstra: ReactNode = null;

  switch (ekspresi) {
    case "senang":
    case "mandi":
      mata = (
        <>
          <Busur d={`M${L - 11} ${KY + 4}q11 -17 22 0`} />
          <Busur d={`M${R - 11} ${KY + 4}q11 -17 22 0`} />
        </>
      );
      alis = <Alis kiri="M68 66q11 -7 22 -1" kanan="M110 65q11 -6 22 1" o={0.8} />;
      mulut =
        ekspresi === "mandi" ? (
          <path d="M85 100q15 14 30 0" stroke={MULUT} strokeWidth={4.2} fill="none" strokeLinecap="round" />
        ) : (
          <g>
            <clipPath id={`${id}-mulut`}>
              <path d="M85 99q15 19 30 0z" />
            </clipPath>
            <path d="M85 99q15 19 30 0z" fill={GELAP} />
            <ellipse cx="100" cy="110" rx="8" ry="5.5" fill="#FF8FA0" clipPath={`url(#${id}-mulut)`} />
            <path d="M85 99q15 19 30 0z" fill="none" stroke={MULUT} strokeWidth={3.2} strokeLinejoin="round" />
          </g>
        );
      pipi = <Pipi o={0.95} besar={1.15} />;
      break;
    case "makan":
      mata = (
        <>
          <Busur tebal={4.6} d={`M${L - 10} ${KY + 3}q10 -13 20 0`} />
          <Busur tebal={4.6} d={`M${R - 10} ${KY + 3}q10 -13 20 0`} />
        </>
      );
      alis = <Alis kiri="M69 68q10 -5 20 0" kanan="M111 68q10 -5 20 0" o={0.75} />;
      mulut = <ellipse cx="100" cy="105" rx="10" ry="8" fill={GELAP} stroke={MULUT} strokeWidth={3} className="syrobo-kunyah" />;
      pipi = <Pipi o={1} besar={1.3} />;
      break;
    case "lapar":
    case "laparKotor":
      mata = (
        <>
          <Mata id={id} cx={L} sisi={-1} ry={11} kelopak={{ luar: 83, dalam: 75 }} />
          <Mata id={id} cx={R} sisi={1} ry={11} kelopak={{ luar: 83, dalam: 75 }} />
        </>
      );
      alis = <Alis kiri="M67 70L90 63" kanan="M133 70L110 63" o={0.9} />;
      mulut = <path d="M88 109q3 -4 6 0t6 0t6 0t6 0" stroke={MULUT} strokeWidth={3.8} fill="none" strokeLinecap="round" />;
      pipi = <Pipi o={0.35} />;
      if (ekspresi === "laparKotor") ekstra = <Keringat x={140} y={66} />;
      break;
    case "kotor":
      mata = (
        <>
          <Mata id={id} cx={L} sisi={-1} ry={10} kelopak={{ luar: 80, dalam: 80 }} />
          <Mata id={id} cx={R} sisi={1} ry={11} kelopak={{ luar: 78, dalam: 76 }} />
        </>
      );
      alis = <Alis kiri="M68 68q11 3 22 4" kanan="M111 62q10 -5 21 -1" o={0.9} />;
      mulut = <path d="M86 108q4.5 -7 9 0t9 0t9 0" stroke={MULUT} strokeWidth={3.8} fill="none" strokeLinecap="round" />;
      pipi = <Pipi o={0.3} />;
      ekstra = <Keringat x={141} y={68} />;
      break;
    case "kaget":
      mata = (
        <>
          <Mata id={id} cx={L} sisi={-1} rx={10.4} ry={13} />
          <Mata id={id} cx={R} sisi={1} rx={10.4} ry={13} />
        </>
      );
      alis = <Alis kiri="M67 63q11 -8 23 -1" kanan="M110 62q12 -7 23 1" o={0.9} />;
      mulut = <path d="M87 111q13 -11 26 0" stroke={MULUT} strokeWidth={3.8} fill="none" strokeLinecap="round" />;
      pipi = <Pipi o={0.4} />;
      ekstra = <Keringat x={140} y={69} />;
      break;
    case "sayu":
      mata = (
        <>
          <Mata id={id} cx={L} sisi={-1} ry={10} kelopak={{ luar: 85, dalam: 83 }} />
          <Mata id={id} cx={R} sisi={1} ry={10} kelopak={{ luar: 85, dalam: 83 }} />
        </>
      );
      alis = <Alis kiri="M68 71q11 -1 22 -4" kanan="M132 71q-11 -1 -22 -4" o={0.8} />;
      mulut = <path d="M91 108q9 -3 18 0" stroke={MULUT} strokeWidth={3.8} fill="none" strokeLinecap="round" />;
      pipi = <Pipi o={0.3} />;
      break;
    case "tidur":
      mata = (
        <>
          <Busur tebal={4.4} d={`M${L - 11} ${KY - 1}q11 9 22 0`} />
          <Busur tebal={4.4} d={`M${R - 11} ${KY - 1}q11 9 22 0`} />
        </>
      );
      alis = <Alis kiri="M69 72q10 -3 20 0" kanan="M111 72q10 -3 20 0" o={0.45} />;
      mulut = <ellipse cx="100" cy="106" rx="3.4" ry="2.8" fill={GELAP} stroke={MULUT} strokeWidth={2.6} />;
      pipi = <Pipi o={0.65} />;
      ekstra = (
        <g className="syrobo-ingus" strokeWidth={0}>
          <circle cx="109.4" cy="106" r="6" fill="rgba(190,238,255,0.28)" stroke="#CFF1FF" strokeWidth={1.4} />
          <ellipse cx="107.6" cy="103.8" rx="1.6" ry="0.9" fill="#fff" opacity={0.85} />
        </g>
      );
      break;
    case "tidurSenang":
      mata = (
        <>
          <Busur tebal={4.6} d={`M${L - 11} ${KY - 2}q11 11 22 0`} />
          <Busur tebal={4.6} d={`M${R - 11} ${KY - 2}q11 11 22 0`} />
        </>
      );
      alis = <Alis kiri="M69 70q10 -4 20 0" kanan="M111 70q10 -4 20 0" o={0.6} />;
      mulut = <path d="M88 101q12 12 24 0" stroke={MULUT} strokeWidth={4} fill="none" strokeLinecap="round" />;
      pipi = <Pipi o={1} besar={1.2} />;
      break;
    case "tidurMarah":
      mata = (
        <>
          <Mata id={id} cx={L} sisi={-1} ry={10.5} kelopak={{ luar: 76, dalam: 88 }} />
          <Mata id={id} cx={R} sisi={1} ry={10.5} kelopak={{ luar: 76, dalam: 88 }} />
        </>
      );
      alis = <Alis kiri="M66 64L92 75" kanan="M134 64L108 75" tebal={3.4} o={0.9} />;
      mulut = (
        <g>
          <path d="M87 104h26v9h-26z" fill="#EAF6FF" stroke={MULUT} strokeWidth={2.6} strokeLinejoin="round" />
          <path d="M93.5 104v9M100 104v9M106.5 104v9M87 108.5h26" stroke="#8A99C4" strokeWidth={1.4} />
        </g>
      );
      pipi = <Pipi o={1} besar={1.25} />;
      ekstra = (
        <g fill="none" stroke="#E8891A" strokeWidth={2.8} strokeLinecap="round">
          <path d="M141 48q2 -1 3 -5M149 48q0 -3 4 -5M141 53q-2 0 -4 1M149 53q3 1 5 -1" />
        </g>
      );
      break;
    case "mati":
      mata = (
        <g stroke="#55607A" strokeWidth={4} strokeLinecap="round">
          <path d="M70 84h18M112 84h18" />
        </g>
      );
      pipi = <Pipi o={0.15} />;
      break;
    default:
      // normal: mata bulat bersorot, alis tipis sedikit terangkat, senyum kecil
      mata = (
        <>
          <Mata id={id} cx={L} sisi={-1} />
          <Mata id={id} cx={R} sisi={1} />
        </>
      );
      alis = <Alis kiri="M69 68q10 -5 20 -1" kanan="M111 67q10 -4 20 1" o={0.7} />;
      mulut = <path d="M87 101q13 11 26 0" stroke={MULUT} strokeWidth={4} fill="none" strokeLinecap="round" />;
      break;
  }

  return (
    <g>
      {defs}
      {pipi}
      <g ref={mataRef} style={{ transition: "transform 180ms cubic-bezier(0.22,1,0.36,1)" }}>
        <g className={berkedip ? "syrobo-mata" : undefined}>{mata}</g>
      </g>
      {alis}
      {mulut}
      {ekstra}
    </g>
  );
}
