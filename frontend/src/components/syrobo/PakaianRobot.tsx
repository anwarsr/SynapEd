import { TINTA } from "./IkonSyrobo";
import type { PakaianId } from "@/lib/syrobo/syroboRules";

/**
 * Gambar pakaian untuk tubuh SyRobo (dipakai di dalam <svg viewBox="0 0 200 240"> milik SyroboRobot).
 *
 * Dua slot: KEPALA dan BADAN. Tiap pakaian digambar PAS pada bentuk badan/kepala robot dan memakai garis tinta yang sama.
 *
 * KERAPIAN: bentuk yang tersusun dari beberapa bagian satu warna (mis. topi koki) digambar dengan `Siluet` - garis tebal di
 * BELAKANG, isian di DEPAN - sehingga hanya garis tepi luarnya yang terlihat dan tidak ada garis tumpang tindih di dalamnya.
 * Garis dalam (kancing, ritsleting, jahitan) selalu berujung tepat di tepi bentuknya, motif badan dipotong `clipPath`.
 *
 * Ukuran = persen dari ukuran bawaan, lewat `skala` berpusat di titik tumpu tiap pakaian (`TUMPU`), jadi pakaian tetap "duduk".
 */

/** Bentuk badan robot - HARUS sama dengan path badan di SyroboRobot. */
export const BENTUK_BADAN = "M78 136c-9 0-13 4-13 11l-1 46c0 8 5 12 13 12h46c8 0 13-4 13-12l-1-46c0-7-4-11-13-11z";

const GARIS = { stroke: TINTA, strokeWidth: 3.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const SW = 3.5;

/** Lingkaran sebagai sub-path (untuk digabung dalam satu `Siluet`). */
const lingkaran = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;

/** Bintang lima sudut sebagai path. */
function bintang(cx: number, cy: number, R: number, r: number): string {
  const titik = Array.from({ length: 10 }, (_, i) => {
    const sudut = (-90 + i * 36) * (Math.PI / 180);
    const jari = i % 2 === 0 ? R : r;
    return `${(cx + jari * Math.cos(sudut)).toFixed(2)} ${(cy + jari * Math.sin(sudut)).toFixed(2)}`;
  });
  return `M${titik.join("L")}Z`;
}

/** Bentuk satu warna: garis tepi luar di belakang, isian di depan (garis tumpang tindih tak terlihat). */
function Siluet({ d, fill }: { d: string; fill: string }) {
  return (
    <>
      <path d={d} fill={TINTA} stroke={TINTA} strokeWidth={SW * 2} strokeLinejoin="round" />
      <path d={d} fill={fill} stroke="none" />
    </>
  );
}

/** Titik tumpu penskalaan tiap pakaian (koordinat SVG). */
export const TUMPU: Record<PakaianId, [number, number]> = {
  topi: [100, 52],
  mahkota: [100, 46],
  kacamata: [100, 82],
  penyihir: [100, 52],
  koki: [100, 46],
  headphone: [100, 80],
  kupluk: [100, 52],
  jerami: [100, 52],
  pesta: [100, 52],
  dasi: [100, 141],
  jubah: [100, 138],
  rompi: [100, 170],
  syal: [100, 140],
  celemek: [100, 170],
  jaket: [100, 170],
  kemeja: [100, 170],
  ransel: [100, 170],
  medali: [100, 150],
};

function Skala({ id, persen, children }: { id: PakaianId; persen: number; children: React.ReactNode }) {
  const [x, y] = TUMPU[id];
  const s = persen / 100;
  return <g transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>{children}</g>;
}

/** Pakaian yang digambar DI BELAKANG badan: jubah, dan sisi ransel yang menyembul. */
export function PakaianBelakang({ id, persen }: { id: PakaianId | null; persen: number }) {
  if (id === "jubah") {
    return (
      <Skala id="jubah" persen={persen}>
        <g {...GARIS}>
          <path d="M68 140Q36 190 46 236L100 228 154 236Q164 190 132 140Z" fill="#7B5CFF" className="syrobo-jubah" />
        </g>
      </Skala>
    );
  }
  if (id === "ransel") {
    return (
      <Skala id="ransel" persen={persen}>
        <g {...GARIS}>
          <rect x="50" y="146" width="20" height="54" rx="8" fill="#B5784A" />
          <rect x="130" y="146" width="20" height="54" rx="8" fill="#B5784A" />
          <path d="M88 140V132Q88 128 92 128H108Q112 128 112 132V140" fill="none" />
        </g>
      </Skala>
    );
  }
  return null;
}

/** Pakaian badan yang digambar DI ATAS badan (dan lengan). Klip memastikan motif tak keluar dari bentuk badan. */
export function PakaianBadan({ id, persen, klip }: { id: PakaianId | null; persen: number; klip: string }) {
  if (!id) return null;

  /** Lengan baju pendek (menutupi bagian atas lengan robot). */
  const lengan = (warna: string, garisBawah = false) => (
    <>
      <path d="M50 143H66V167H50Q44 167 44 161V149Q44 143 50 143Z" fill={warna} />
      <path d="M150 143H134V167H150Q156 167 156 161V149Q156 143 150 143Z" fill={warna} />
      {garisBawah && <path d="M44 160H66M134 160H156" fill="none" />}
    </>
  );

  return (
    <Skala id={id} persen={persen}>
      <clipPath id={klip}>
        <path d={BENTUK_BADAN} />
      </clipPath>
      <g {...GARIS}>
        {id === "jubah" && (
          <>
            {/* kainnya di belakang badan; di sini hanya kerah dan kancing */}
            <path d="M82 140Q100 150 118 140" fill="none" />
            <circle cx="100" cy="146" r="5" fill="#F2C14E" />
          </>
        )}

        {id === "rompi" && (
          <>
            <path d={BENTUK_BADAN} fill="#3D5A80" />
            <path d="M86 136L100 162L114 136Z" fill="#F6F0E2" />
            <path d="M100 162V204" fill="none" strokeWidth={2.4} />
            <circle cx="100" cy="174" r="2.8" fill="#F2C14E" strokeWidth={2} />
            <circle cx="100" cy="188" r="2.8" fill="#F2C14E" strokeWidth={2} />
          </>
        )}

        {id === "celemek" && (
          <>
            <path d={BENTUK_BADAN} fill="#8FBF9F" />
            <path d="M65 158H135" fill="none" strokeWidth={2.6} />
            <rect x="86" y="174" width="28" height="18" rx="3" fill="#6FA583" strokeWidth={2.6} />
          </>
        )}

        {id === "dasi" && (
          <>
            <path d="M100 142L76 130V154Z" fill="#E56B5D" />
            <path d="M100 142L124 130V154Z" fill="#E56B5D" />
            <rect x="93" y="135" width="14" height="14" rx="4" fill="#B94B3E" />
          </>
        )}

        {id === "syal" && (
          <>
            {/* ekor syal di belakang lilitan */}
            <path d="M108 150L116 186L132 182L124 146Z" fill="#E56B5D" />
            <path d="M62 134Q100 152 138 134V148Q100 166 62 148Z" fill="#E56B5D" />
          </>
        )}

        {id === "jaket" && (
          <>
            <path d={BENTUK_BADAN} fill="#E0833B" />
            <path d="M88 136L100 158L112 136Z" fill="#F6F0E2" />
            <path d="M100 158V204" fill="none" strokeWidth={2.6} />
            <path d="M74 184H88M112 184H126" fill="none" strokeWidth={2.6} />
            {lengan("#E0833B", true)}
          </>
        )}

        {id === "kemeja" && (
          <>
            <path d={BENTUK_BADAN} fill="#9CC9EC" />
            <rect x="108" y="160" width="16" height="14" rx="2" fill="#9CC9EC" strokeWidth={2.6} />
            <circle cx="100" cy="168" r="2.6" fill="#F6F0E2" strokeWidth={2} />
            <circle cx="100" cy="182" r="2.6" fill="#F6F0E2" strokeWidth={2} />
            <circle cx="100" cy="196" r="2.6" fill="#F6F0E2" strokeWidth={2} />
            {lengan("#9CC9EC")}
            <path d="M78 136H98L100 154Z" fill="#FFFFFF" />
            <path d="M122 136H102L100 154Z" fill="#FFFFFF" />
          </>
        )}

        {id === "ransel" && (
          <>
            {/* tali ransel di depan badan */}
            <rect x="72" y="136" width="9" height="68" rx="3" fill="#B5784A" />
            <rect x="119" y="136" width="9" height="68" rx="3" fill="#B5784A" />
            <rect x="70.5" y="170" width="12" height="7" rx="2" fill="#F2C14E" strokeWidth={2.6} />
            <rect x="117.5" y="170" width="12" height="7" rx="2" fill="#F2C14E" strokeWidth={2.6} />
          </>
        )}

        {id === "medali" && (
          <>
            {/* pita V: garis tinta di belakang, warna di depan (ujung tepat di tepi atas badan) */}
            <path d="M80 136L100 172L120 136" fill="none" stroke={TINTA} strokeWidth={14} strokeLinecap="butt" strokeLinejoin="round" />
            <path d="M80 136L100 172L120 136" fill="none" stroke="#E56B5D" strokeWidth={7.5} strokeLinecap="butt" strokeLinejoin="round" />
            <circle cx="100" cy="180" r="12" fill="#F2C14E" />
            <circle cx="100" cy="180" r="6.5" fill="none" strokeWidth={2.4} />
          </>
        )}
      </g>
    </Skala>
  );
}

/** Pakaian kepala: digambar di atas kepala (setelah layar wajah). */
export function PakaianKepala({ id, persen }: { id: PakaianId | null; persen: number }) {
  if (!id) return null;
  return (
    <Skala id={id} persen={persen}>
      <g {...GARIS}>
        {id === "topi" && (
          <>
            <path d="M52 56C52 22 148 22 148 56Z" fill="#E56B5D" />
            <path d="M116 52H162Q170 52 170 58Q170 64 162 64H116Z" fill="#B94B3E" />
            <circle cx="100" cy="30" r="4.5" fill="#F2C14E" strokeWidth={2.6} />
          </>
        )}

        {id === "mahkota" && (
          <>
            <path d="M56 52L60 16L82 34L100 8L118 34L140 16L144 52Z" fill="#F2C14E" />
            <path d="M57 44H143" fill="none" />
            <circle cx="100" cy="30" r="3.6" fill="#E56B5D" strokeWidth={2.4} />
            <circle cx="78" cy="38" r="2.8" fill="#6BA7D8" strokeWidth={2.2} />
            <circle cx="122" cy="38" r="2.8" fill="#6BA7D8" strokeWidth={2.2} />
          </>
        )}

        {id === "kacamata" && (
          <>
            <circle cx="79" cy="82" r="16" fill="#BFE7F5" fillOpacity=".18" strokeWidth={4} />
            <circle cx="121" cy="82" r="16" fill="#BFE7F5" fillOpacity=".18" strokeWidth={4} />
            <path d="M95 80Q100 75 105 80" fill="none" strokeWidth={4} />
            <path d="M63 80L46 76M137 80L154 76" fill="none" strokeWidth={3} />
          </>
        )}

        {id === "penyihir" && (
          <>
            <path d="M66 54L98 4Q104 -10 110 4L134 54Z" fill="#5B4B9A" />
            <path d="M78.8 34H124.4L128.2 42H73.7Z" fill="#F2C14E" strokeWidth={2.6} />
            <path d={bintang(101, 20, 7, 3)} fill="#F2C14E" strokeWidth={2} />
            <ellipse cx="100" cy="54" rx="56" ry="9" fill="#4A3C80" />
          </>
        )}

        {id === "koki" && (
          <>
            <Siluet d={`${lingkaran(68, 32, 14)}${lingkaran(100, 22, 18)}${lingkaran(132, 32, 14)}M54 36V52H146V36Z`} fill="#FFFFFF" />
            <path d="M54 44H146" fill="none" strokeWidth={2.4} />
          </>
        )}

        {id === "headphone" && (
          <>
            <path d="M44 86C42 22 158 22 156 86" fill="none" strokeWidth={14} strokeLinecap="butt" />
            <path d="M44 86C42 22 158 22 156 86" fill="none" strokeWidth={7} stroke="#E56B5D" strokeLinecap="butt" />
            <rect x="26" y="72" width="22" height="40" rx="9" fill="#E56B5D" />
            <rect x="152" y="72" width="22" height="40" rx="9" fill="#E56B5D" />
          </>
        )}

        {id === "kupluk" && (
          <>
            <path d="M54 54C54 20 146 20 146 54Z" fill="#6BA7D8" />
            <path d="M50 46H150Q154 46 154 50V52Q154 56 150 56H50Q46 56 46 52V50Q46 46 50 46Z" fill="#4F8AB8" />
            <circle cx="100" cy="19" r="10" fill="#F6F0E2" />
          </>
        )}

        {id === "jerami" && (
          <>
            <ellipse cx="100" cy="52" rx="66" ry="9" fill="#E8C469" />
            <path d="M72 52C72 24 128 24 128 52Z" fill="#E8C469" />
            <path d="M73.4 44H126.6L128 52H72Z" fill="#E56B5D" strokeWidth={2.6} />
          </>
        )}

        {id === "pesta" && (
          <>
            <path d="M72 54L100 -6L128 54Z" fill="#F28CB1" />
            <circle cx="100" cy="28" r="3.6" fill="#F2C14E" strokeWidth={0} />
            <circle cx="90" cy="42" r="3.2" fill="#F2C14E" strokeWidth={0} />
            <circle cx="110" cy="42" r="3.2" fill="#F2C14E" strokeWidth={0} />
            <circle cx="100" cy="-8" r="7" fill="#F2C14E" />
          </>
        )}
      </g>
    </Skala>
  );
}
