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
  topiKaisar: [100, 52],
  mahkotaRaja: [100, 46],
  bajuKaisar: [100, 170],
  jubahRaja: [100, 138],
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
  if (id === "jubahRaja") {
    return (
      <Skala id="jubahRaja" persen={persen}>
        <g {...GARIS}>
          <path d="M68 140Q34 190 42 238L100 230 158 238Q166 190 132 140Z" fill="#A82B3F" className="syrobo-jubah" />
          {/* tepi bawah berbulu ermine */}
          <path d="M42 238L100 230 158 238Q159 226 157 220Q100 214 43 220Q41 228 42 238Z" fill="#FBF1DA" className="syrobo-jubah" />
          <g fill={TINTA} stroke="none" className="syrobo-jubah">
            <path d="M58 222l2.500 9-3.200.2zM84 222l2.500 9-3.200.2zM112 222l2.500 9-3.200.2zM140 222l2.500 9-3.200.2z" />
          </g>
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

        {id === "bajuKaisar" && (
          <>
            {/* seragam militer cokelat: kerah, kancing emas, dua saku bertutup, pundak, ikat pinggang */}
            <path d={BENTUK_BADAN} fill="#7C5B37" />
            <g clipPath={`url(#${klip})`}>
              <rect x="60" y="188" width="80" height="11" fill="#3B2A1A" strokeWidth={0} />
              <path d="M100 150V212" fill="none" stroke="#54391F" strokeWidth={2.600} />
            </g>
            <rect x="92" y="186" width="16" height="15" rx="2.500" fill="#D9B24A" strokeWidth={2.600} />
            <path d="M84 136L100 156L116 136Z" fill="#5E4328" />
            <path d="M80 136L92 150L100 156L84 136Z" fill="#6A4B2D" strokeWidth={0} />
            <rect x="76" y="162" width="18" height="15" rx="2" fill="#6A4B2D" strokeWidth={2.600} />
            <rect x="106" y="162" width="18" height="15" rx="2" fill="#6A4B2D" strokeWidth={2.600} />
            <circle cx="85" cy="170" r="1.800" fill="#D9B24A" strokeWidth={0} />
            <circle cx="115" cy="170" r="1.800" fill="#D9B24A" strokeWidth={0} />
            <circle cx="100" cy="166" r="2.400" fill="#D9B24A" strokeWidth={2} />
            <circle cx="100" cy="178" r="2.400" fill="#D9B24A" strokeWidth={2} />
            {lengan("#7C5B37", true)}
            <rect x="68" y="131" width="20" height="8" rx="2" fill="#54391F" strokeWidth={2.600} />
            <rect x="112" y="131" width="20" height="8" rx="2" fill="#54391F" strokeWidth={2.600} />
          </>
        )}

        {id === "jubahRaja" && (
          <>
            {/* kain merah ada di belakang; di depan: kerah ermine lebar, ekor hitam, dan bros emas berantai */}
            <path d="M72 134Q100 160 128 134L136 148Q100 176 64 148Z" fill="#FBF1DA" />
            <path d="M76 146Q74 176 80 206L90 206Q86 176 86 154Z" fill="#FBF1DA" />
            <path d="M124 146Q126 176 120 206L110 206Q114 176 114 154Z" fill="#FBF1DA" />
            <g fill={TINTA} stroke="none">
              <path d="M84 150l2.600 10-3.400.4zM100 158l2.600 10-3.400.4zM116 150l2.600 10-3.400.4zM81 184l2.600 9-3.400.4zM119 184l2.600 9-3.400.4z" />
            </g>
            <path d="M88 142Q100 150 112 142" fill="none" strokeWidth={2.6} />
            <circle cx="100" cy="150" r="5.500" fill="#F2C14E" strokeWidth={2.800} />
            <circle cx="100" cy="150" r="2" fill="#E56B5D" strokeWidth={0} />
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

        {id === "topiKaisar" && (
          <>
            {/* topi militer cokelat: kubah, pita gelap, lidah topi yang tampak dari depan, lencana emas */}
            <path d="M54 56C52 32 66 20 100 20S148 32 146 56Z" fill="#7C5B37" />
            <path d="M62 36C68 28 80 24 92 23C80 28 72 34 68 44Z" fill="#9A7549" strokeWidth={0} opacity=".7" />
            <path d="M52 50H148V60Q100 67 52 60Z" fill="#54391F" />
            <path d="M60 60H140Q143 71 100 73Q57 71 60 60Z" fill="#2F2014" />
            <circle cx="100" cy="42" r="8.500" fill="#D9B24A" strokeWidth={2.600} />
            <path d={bintang(100, 42, 5.200, 2.200)} fill="#54391F" strokeWidth={0} />
            <circle cx="62" cy="54" r="3" fill="#D9B24A" strokeWidth={2} />
            <circle cx="138" cy="54" r="3" fill="#D9B24A" strokeWidth={2} />
          </>
        )}

        {id === "mahkotaRaja" && (
          <>
            {/* mahkota raja: topi beludru merah, pita emas bergerigi lima, pinggiran ermine berbintik, permata */}
            <path d="M62 50C62 14 138 14 138 50Z" fill="#B3344A" />
            <path d="M54 52L57 22L78 38L100 6L122 38L143 22L146 52Z" fill="#F2C14E" />
            <path d="M52 44H148V56Q100 63 52 56Z" fill="#FBF1DA" />
            <g fill={TINTA} stroke="none">
              <path d="M66 50l2.400 8-3.200.4zM92 53l2.400 8-3.200.4zM118 53l2.400 8-3.200.4zM136 50l2.400 8-3.200.4z" />
            </g>
            <circle cx="100" cy="28" r="4.400" fill="#E56B5D" strokeWidth={2.600} />
            <circle cx="77" cy="38" r="3.400" fill="#6BA7D8" strokeWidth={2.400} />
            <circle cx="123" cy="38" r="3.400" fill="#6BA7D8" strokeWidth={2.400} />
            <circle cx="100" cy="6" r="4.600" fill="#F2C14E" strokeWidth={2.600} />
            <circle cx="57" cy="22" r="3.400" fill="#F2C14E" strokeWidth={2.400} />
            <circle cx="143" cy="22" r="3.400" fill="#F2C14E" strokeWidth={2.400} />
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
