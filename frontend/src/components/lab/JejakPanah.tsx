"use client";
import { useId, useLayoutEffect, useRef, type RefObject } from "react";

const SVG = "http://www.w3.org/2000/svg";

/**
 * Jejak penelusuran: garis berpanah yang menghubungkan sel-sel yang sudah
 * dikunjungi, berurutan.
 *
 * Satu sel yang berpindah-pindah sorotannya tidak cukup untuk siswa awam —
 * begitu sorotan pindah, urutan sebelumnya hilang dari ingatan. Jejak ini
 * membuat POLANYA terlihat utuh: zig-zag baris demi baris, lompatan panjang
 * di akhir setiap kolom, atau lompatan menembus lapisan pada kubus.
 *
 * Posisi diukur dari sel yang sungguh tergambar (`[data-lab-id]` di dalam
 * wadah), bukan dihitung ulang dari koordinat, sehingga komponen yang sama
 * bekerja di kisi 2D, kotak bersarang N-D, dan kubus 3D yang sedang diputar
 * (proyeksi layarnya yang diukur). Wadah harus `position: relative`.
 *
 * Garisnya ditulis langsung ke DOM di layout effect, bukan lewat state: ia
 * turunan murni dari tata letak, dan setState dari effect dilarang lint.
 */
export default function JejakPanah({
  wadahRef,
  jalur,
}: {
  wadahRef: RefObject<HTMLElement | null>;
  /** Id sel yang sudah dikunjungi, berurutan; kosong/undefined = tanpa jejak. */
  jalur: readonly number[] | undefined;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const kelompokRef = useRef<SVGGElement>(null);
  const idPanah = `jejak${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const ids = jalur ?? [];

  // Digambar ulang SETIAP render (tanpa dependensi): kubus yang diputar atau
  // sel yang bergeser mengubah posisi tanpa mengubah `jalur`.
  useLayoutEffect(() => {
    gambar(wadahRef.current, kelompokRef.current, ids, idPanah);
  });

  // Transisi (putaran kubus, sel meluncur) dan perubahan ukuran memindahkan
  // sel SETELAH render; jejaknya disusulkan saat gerak itu selesai.
  const idsRef = useRef(ids);
  useLayoutEffect(() => {
    idsRef.current = ids;
  });
  useLayoutEffect(() => {
    const wadah = wadahRef.current;
    if (!wadah) return;
    const ulang = () => gambar(wadahRef.current, kelompokRef.current, idsRef.current, idPanah);
    wadah.addEventListener("transitionend", ulang);
    const ro = new ResizeObserver(ulang);
    ro.observe(wadah);
    return () => {
      wadah.removeEventListener("transitionend", ulang);
      ro.disconnect();
    };
  }, [wadahRef, idPanah]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
    >
      <defs>
        <marker id={`${idPanah}-baru`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-blue-600)" />
        </marker>
        <marker id={`${idPanah}-lama`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--color-blue-300)" />
        </marker>
      </defs>
      <g ref={kelompokRef} />
    </svg>
  );
}

function gambar(wadah: HTMLElement | null, g: SVGGElement | null, ids: readonly number[], idPanah: string) {
  if (!wadah || !g) return;
  if (ids.length === 0) {
    if (g.childNodes.length > 0) g.replaceChildren();
    return;
  }
  // Wadah yang sedang disembunyikan (lab lain aktif) tidak punya ukuran.
  if (wadah.getClientRects().length === 0) return;

  const asal = wadah.getBoundingClientRect();
  const titik = ids.map((id) => {
    const el = wadah.querySelector<HTMLElement>(`[data-lab-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - asal.left + r.width / 2, y: r.top - asal.top + r.height / 2, jari: Math.min(r.width, r.height) * 0.42 };
  });

  // Tanpa penanda titik mulai: nomor urut "1" di pojok sel sudah menandainya,
  // dan lingkaran di tengah sel menutupi angka di dalamnya.
  const anak: SVGElement[] = [];
  for (let n = 1; n < titik.length; n++) {
    const a = titik[n - 1];
    const b = titik[n];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const panjang = Math.hypot(dx, dy);
    if (panjang < 1) continue;
    // Ujung garis dipotong di tepi sel, supaya panah tidak menutupi angkanya.
    const ux = dx / panjang;
    const uy = dy / panjang;
    const potongA = Math.min(a.jari, panjang / 3);
    const potongB = Math.min(b.jari, panjang / 3);
    const baru = n === titik.length - 1;
    const garis = document.createElementNS(SVG, "line");
    garis.setAttribute("x1", String(a.x + ux * potongA));
    garis.setAttribute("y1", String(a.y + uy * potongA));
    garis.setAttribute("x2", String(b.x - ux * potongB));
    garis.setAttribute("y2", String(b.y - uy * potongB));
    garis.setAttribute("stroke-linecap", "round");
    garis.setAttribute("class", baru ? "lab-jejak-baru" : "lab-jejak-lama");
    garis.setAttribute("marker-end", `url(#${idPanah}-${baru ? "baru" : "lama"})`);
    anak.push(garis);
  }
  g.replaceChildren(...anak);
}

/**
 * Nomor urut kunjungan di pojok sel (1, 2, 3, …). Melengkapi garis jejak:
 * garis menunjukkan arah, nomor menunjukkan urutan tanpa perlu mengikuti
 * garisnya dari awal. Kunjungan terbaru berwarna penuh.
 */
export function NomorKunjungan({ jalur, id }: { jalur: readonly number[] | undefined; id: number }) {
  if (!jalur) return null;
  const i = jalur.indexOf(id);
  if (i < 0) return null;
  const terbaru = i === jalur.length - 1;
  return (
    <span
      aria-hidden="true"
      className={
        terbaru
          ? "t-numeral absolute -bottom-1.5 -left-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-semibold tabular-nums text-white "
          : "t-numeral absolute -bottom-1.5 -left-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full   bg-blue-50 px-1 text-[9px] tabular-nums text-blue-700"
      }
    >
      {i + 1}
    </span>
  );
}

/**
 * Label variabel algoritma di atas sel (`j`, `min`, `pivot`, …). Kuncinya
 * teks labelnya, jadi saat label pindah ke sel lain ia "mendarat" dengan
 * pantulan kecil — mata mengikuti variabel yang bergerak.
 */
export function LabelSel({ labelSel, id }: { labelSel: Record<number, string> | undefined; id: number }) {
  const teks = labelSel?.[id];
  if (!teks) return null;
  return (
    <span
      key={teks}
      aria-hidden="true"
      className="lab-land pointer-events-none absolute -top-3.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-1.5 py-px text-[10px] font-semibold leading-tight text-paper "
    >
      {teks}
    </span>
  );
}
