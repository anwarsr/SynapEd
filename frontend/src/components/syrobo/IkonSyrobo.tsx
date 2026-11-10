import type { MakananId, PakaianId } from "@/lib/syrobo/syroboRules";

/**
 * Ikon SyRobo digambar tangan (SVG): garis tinta tebal membulat, warna datar hangat, bentuk sengaja sedikit tak
 * simetris - bukan emoji sistem dan bukan ikon garis seragam. Semua berukuran 48x48 dan mengikuti ukuran induknya.
 */
export const TINTA = "#2B2233";

const GARIS = { stroke: TINTA, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export type IkonDok = "makan" | "mandi" | "baju" | "toko" | "hadiah";

/** Lingkaran sebagai sub-path (digabung dalam satu `Siluet`). */
const ling = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

/** Bentuk satu warna: garis tepi luar di belakang, isian di depan - garis tumpang tindih di dalamnya tak terlihat. */
function Siluet({ d, fill }: { d: string; fill: string }) {
  return (
    <>
      <path d={d} fill={TINTA} stroke={TINTA} strokeWidth={5.2} strokeLinejoin="round" />
      <path d={d} fill={fill} stroke="none" />
    </>
  );
}

export function Ikon({ nama, className }: { nama: IkonDok | MakananId | PakaianId | "bintang" | "spons"; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" {...GARIS}>
      {gambar(nama)}
    </svg>
  );
}

function gambar(nama: IkonDok | MakananId | PakaianId | "bintang" | "spons") {
  switch (nama) {
    case "makan":
    case "burger":
      return (
        <>
          <path d="M7 23C6 14 14 8 24 8s18 6 17 15z" fill="#E8A33D" />
          <path d="M16 15l2 1M25 12l2 1M32 16l2 1M21 18l2 1" strokeWidth={2.2} />
          <path d="M6 27c3 3 5-2 8 1s5-2 8 1 5-2 8 1 5-2 8 1 3-1 4-2" fill="#7FB069" />
          <rect x="7" y="30" width="34" height="6" rx="3" fill="#7A4A2E" />
          <path d="M7 38h34c0 4-3 6-7 6H14c-4 0-7-2-7-6z" fill="#E8A33D" />
        </>
      );
    case "mandi":
      return (
        <>
          <circle cx="14" cy="13" r="4.5" fill="#fff" />
          <circle cx="24" cy="8" r="3" fill="#fff" />
          <circle cx="33" cy="14" r="5.5" fill="#fff" />
          <path d="M5 24h38v3c0 8-6 13-13 13H18C11 40 5 35 5 27z" fill="#8FBCD6" />
          <path d="M10 40l-2 4M38 40l2 4" />
          <path d="M11 30c4 2 8 2 12 0" strokeWidth={2} opacity=".5" />
        </>
      );
    case "baju":
      return <path d="M17 7L5 14l5 8 6-3v23h17V19l6 3 5-8-12-7c-1 4-4 6-8 6s-7-2-8-6z" fill="#E56B5D" />;
    case "toko":
      return (
        <>
          <path d="M14 20c0-9 4-13 10-13s10 4 10 13" />
          <path d="M5 20h38l-4 22H9z" fill="#C98B4F" />
          <path d="M9 28h30M11 35h26M18 20l-1 22M30 20l1 22" strokeWidth={2} opacity=".55" />
        </>
      );
    case "hadiah":
      return (
        <>
          <rect x="8" y="22" width="32" height="20" rx="2" fill="#6BA7D8" />
          <rect x="5" y="15" width="38" height="9" rx="2" fill="#8DC1EA" />
          <rect x="21" y="15" width="6" height="27" fill="#F2C14E" />
          <path d="M24 15c-5-9-14-5-10-1s10 1 10 1zM24 15c5-9 14-5 10-1s-10 1-10 1z" fill="#F2C14E" />
        </>
      );
    case "roti":
      return (
        <>
          <path d="M7 24c0-8 7-13 17-13s17 5 17 13c0 2-1 3-3 3v11c0 3-2 4-4 4H14c-2 0-4-1-4-4V27c-2 0-3-1-3-3z" fill="#E3A857" />
          <path d="M17 18c2-1 4 1 6 0M26 18c2-1 4 1 6 0" strokeWidth={2.2} />
          <path d="M16 32h16" strokeWidth={2} opacity=".5" />
        </>
      );
    case "nasi":
      return (
        <>
          <path d="M10 26c1-8 7-13 14-13s13 5 14 13z" fill="#FFF6E0" />
          <path d="M17 21l2 1M24 18l2 1M29 22l2 1M21 24l2 1" strokeWidth={2} />
          <path d="M4 27h40c0 9-8 15-20 15S4 36 4 27z" fill="#D9664F" />
          <path d="M12 34c4 2 8 2 12 1" strokeWidth={2} opacity=".5" />
        </>
      );
    case "pizza":
      return (
        <>
          <path d="M5 13c12-7 26-7 38 0L25 43z" fill="#F2C14E" />
          <path d="M5 13c12-7 26-7 38 0" strokeWidth={4.5} stroke="#D6903C" />
          <circle cx="17" cy="21" r="3.2" fill="#D9564A" />
          <circle cx="29" cy="20" r="3.2" fill="#D9564A" />
          <circle cx="24" cy="32" r="3" fill="#D9564A" />
        </>
      );
    case "topi":
      return (
        <>
          <path d="M8 30C8 10 36 10 36 30Z" fill="#E56B5D" />
          <path d="M26 27H41Q44 27 44 30Q44 33 41 33H26Z" fill="#B94B3E" />
          <circle cx="22" cy="13" r="2.4" fill="#F2C14E" strokeWidth={2} />
        </>
      );
    case "kacamata":
      return (
        <>
          <circle cx="14" cy="26" r="8" fill="#BFE7F5" fillOpacity=".5" />
          <circle cx="34" cy="26" r="8" fill="#BFE7F5" fillOpacity=".5" />
          <path d="M22 25Q24 22 26 25" fill="none" />
          <path d="M6 24L4.5 21M42 24L43.5 21" fill="none" />
        </>
      );
    case "dasi":
      return (
        <>
          <path d="M24 24L7 14V34Z" fill="#E56B5D" />
          <path d="M24 24L41 14V34Z" fill="#E56B5D" />
          <rect x="19.5" y="19" width="9" height="10" rx="2.6" fill="#B94B3E" />
        </>
      );
    case "mahkota":
      return (
        <>
          <path d="M6 36L8 14L18 24L24 9L30 24L40 14L42 36Z" fill="#F2C14E" />
          <path d="M6.6 30H41.4" fill="none" strokeWidth={2.2} />
          <circle cx="24" cy="23" r="2.3" fill="#E56B5D" strokeWidth={1.8} />
        </>
      );
    case "jubah":
      return (
        <>
          <path d="M16 8H32L41 40Q24 46 7 40Z" fill="#7B5CFF" />
          <path d="M16 8Q24 15 32 8" fill="none" />
          <circle cx="24" cy="13" r="2.4" fill="#F2C14E" strokeWidth={2} />
        </>
      );
    case "penyihir":
      return (
        <>
          <path d="M14 34L21 8Q24 1 27 8L34 34Z" fill="#5B4B9A" />
          <path d="M16.2 26H31.8L33 31H15Z" fill="#F2C14E" strokeWidth={2.2} />
          <ellipse cx="24" cy="35" rx="19" ry="5" fill="#4A3C80" />
        </>
      );
    case "koki":
      return (
        <>
          <Siluet d={`${ling(15, 22, 7)}${ling(24, 16, 9)}${ling(33, 22, 7)}M8 24V36H40V24Z`} fill="#FFFFFF" />
          <path d="M8 30H40" fill="none" strokeWidth={2.2} />
        </>
      );
    case "headphone":
      return (
        <>
          <path d="M9 30C9 8 39 8 39 30" fill="none" strokeWidth={7} strokeLinecap="butt" />
          <path d="M9 30C9 8 39 8 39 30" fill="none" strokeWidth={3.4} stroke="#E56B5D" strokeLinecap="butt" />
          <rect x="5" y="26" width="9" height="15" rx="3.5" fill="#E56B5D" />
          <rect x="34" y="26" width="9" height="15" rx="3.5" fill="#E56B5D" />
        </>
      );
    case "kupluk":
      return (
        <>
          <path d="M10 30C10 10 38 10 38 30Z" fill="#6BA7D8" />
          <path d="M8 28H40V36Q40 38 38 38H10Q8 38 8 36Z" fill="#4F8AB8" />
          <circle cx="24" cy="10" r="4.6" fill="#F6F0E2" />
        </>
      );
    case "jerami":
      return (
        <>
          <ellipse cx="24" cy="31" rx="20" ry="5.5" fill="#E8C469" />
          <path d="M15 31C15 14 33 14 33 31Z" fill="#E8C469" />
          <path d="M15.6 25H32.4L33 31H15Z" fill="#E56B5D" strokeWidth={2.2} />
        </>
      );
    case "pesta":
      return (
        <>
          <path d="M13 38L24 8L35 38Z" fill="#F28CB1" />
          <circle cx="24" cy="24" r="2" fill="#F2C14E" strokeWidth={0} />
          <circle cx="19.5" cy="32" r="2" fill="#F2C14E" strokeWidth={0} />
          <circle cx="28.5" cy="32" r="2" fill="#F2C14E" strokeWidth={0} />
          <circle cx="24" cy="7" r="3.6" fill="#F2C14E" />
        </>
      );
    case "rompi":
      return (
        <>
          <path d="M14 7L24 22L34 7L40 12V42H8V12Z" fill="#3D5A80" />
          <path d="M24 22V42" fill="none" strokeWidth={2} />
          <circle cx="24" cy="29" r="1.8" fill="#F2C14E" strokeWidth={1.6} />
          <circle cx="24" cy="36" r="1.8" fill="#F2C14E" strokeWidth={1.6} />
        </>
      );
    case "syal":
      return (
        <>
          <path d="M30 24L33 42L41 40L38 22Z" fill="#E56B5D" />
          <path d="M6 12Q24 22 42 12V22Q24 32 6 22Z" fill="#E56B5D" />
        </>
      );
    case "celemek":
      return (
        <>
          <path d="M17 6H31L35 17H43V43H5V17H13Z" fill="#8FBF9F" />
          <rect x="17" y="28" width="14" height="9" rx="2" fill="#6FA583" strokeWidth={2} />
        </>
      );
    case "jaket":
      return (
        <>
          <path d="M16 7L5 14V32H12V43H36V32H43V14L32 7L24 15Z" fill="#E0833B" />
          <path d="M24 15V43" fill="none" strokeWidth={2.2} />
        </>
      );
    case "kemeja":
      return (
        <>
          <path d="M15 8L5 14L9 22L14 19V42H34V19L39 22L43 14L33 8Z" fill="#9CC9EC" />
          <path d="M16 8L24 22L32 8L28 7L24 12L20 7Z" fill="#FFFFFF" />
          <circle cx="24" cy="29" r="1.8" fill="#F6F0E2" strokeWidth={1.6} />
          <circle cx="24" cy="36" r="1.8" fill="#F6F0E2" strokeWidth={1.6} />
        </>
      );
    case "ransel":
      return (
        <>
          <path d="M13 9Q24 4 35 9V40Q24 45 13 40Z" fill="#B5784A" />
          <path d="M13 9Q24 4 35 9V20H13Z" fill="#9A633A" />
          <rect x="17" y="28" width="14" height="9" rx="2" fill="#B5784A" strokeWidth={2} />
        </>
      );
    case "medali":
      return (
        <>
          <path d="M12 5L24 28L36 5" fill="none" strokeWidth={8.4} strokeLinecap="butt" strokeLinejoin="round" />
          <path d="M12 5L24 28L36 5" fill="none" strokeWidth={3.8} stroke="#E56B5D" strokeLinecap="butt" strokeLinejoin="round" />
          <circle cx="24" cy="35" r="8.5" fill="#F2C14E" />
          <circle cx="24" cy="35" r="4.4" fill="none" strokeWidth={2} />
        </>
      );
    case "spons":
      return (
        <>
          <rect x="5" y="14" width="38" height="22" rx="7" fill="#F2C14E" transform="rotate(-8 24 25)" />
          <g fill="#D9A93E" stroke="none">
            <circle cx="14" cy="22" r="2.4" />
            <circle cx="24" cy="28" r="2.8" />
            <circle cx="33" cy="21" r="2.2" />
            <circle cx="36" cy="30" r="1.8" />
            <circle cx="17" cy="31" r="1.8" />
          </g>
        </>
      );
    case "bintang":
      return <path d="M24 5l5.6 12 13 1.6-9.6 9 2.6 12.9L24 33.6 12.4 40.5 15 27.6l-9.6-9 13-1.6z" fill="#F2C14E" />;
    default:
      return null;
  }
}
