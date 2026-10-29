/**
 * Warna simbol & pengekspor SVG mandiri.
 *
 * Ekspor dibangun dari DATA (bukan menyalin DOM kanvas): DOM memakai
 * variabel CSS tema yang tidak ikut terbawa ke berkas, dan elemen
 * `foreignObject` membuat kanvas PNG "tercemar" sehingga tidak bisa diunduh.
 * Teks digambar sebagai `<text>/<tspan>` dari `barisSimpul` — pembungkusan
 * yang sama dengan di layar.
 *
 * Berkas ekspor SELALU berlatar putih bertinta gelap, apa pun tema situs:
 * hasilnya ditempel ke laporan dan slide, bukan ke situs ini.
 *
 * Modul netral.
 */
import { barisSimpul, batasDiagram, bentukSimpul, dGaris, posisiLabel, titikGaris, TINGGI_BARIS, UKURAN_FONT } from "./flowGeometri";
import type { Diagram, JenisSimpul, Simpul } from "./flowTypes";

/** Warna rona per jenis — dipakai kanvas (dicampur dengan warna kartu tema) dan ekspor. */
export const RONA_JENIS: Record<JenisSimpul, string> = {
  mulai: "#2F6FED",
  selesai: "#2F6FED",
  proses: "#5B6B7F",
  io: "#0E9384",
  keputusan: "#C88A1C",
  persiapan: "#7C5CE0",
  subproses: "#5B6B7F",
  konektor: "#5B6B7F",
  dokumen: "#5B6B7F",
  data: "#5B6B7F",
  catatan: "#7A8794",
};

/** Isi bentuk di berkas ekspor: rona dicampur putih 88%. */
function isiTerang(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const campur = (c: number) => Math.round(c * 0.12 + 255 * 0.88);
  return `rgb(${campur((n >> 16) & 255)},${campur((n >> 8) & 255)},${campur(n & 255)})`;
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** Posisi baris teks: tegak di tengah bentuk (keputusan sedikit lebih rapat). */
export function tataTeks(s: Simpul): { baris: string[]; x: number; y0: number } {
  const baris = barisSimpul(s);
  const tinggi = baris.length * TINGGI_BARIS;
  const tengahY = s.jenis === "dokumen" ? s.y + s.h * 0.42 : s.y + s.h / 2;
  return { baris, x: s.x + s.w / 2, y0: tengahY - tinggi / 2 + TINGGI_BARIS * 0.78 };
}

const PADDING = 30;

/** SVG lengkap (string) untuk diunduh, atau null bila diagram kosong. */
export function diagramKeSvg(d: Diagram): string | null {
  const b = batasDiagram(d);
  if (!b) return null;
  const x0 = b.x - PADDING;
  const y0 = b.y - PADDING;
  const w = Math.ceil(b.w + PADDING * 2);
  const h = Math.ceil(b.h + PADDING * 2);
  const font = `font-family="Plus Jakarta Sans, Segoe UI, Arial, sans-serif" font-size="${UKURAN_FONT}"`;

  const bagian: string[] = [];
  bagian.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}">`,
    `<defs><marker id="panah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#334155"/></marker></defs>`,
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`,
  );

  for (const g of d.garis) {
    const t = titikGaris(d, g);
    if (!t) continue;
    bagian.push(`<path d="${dGaris(t)}" fill="none" stroke="#334155" stroke-width="1.6" marker-end="url(#panah)"/>`);
    if (g.label.trim()) {
      const p = posisiLabel(t);
      bagian.push(
        `<text x="${p.x}" y="${p.y}" ${font} font-size="12" font-weight="600" fill="#334155" stroke="#ffffff" stroke-width="4" paint-order="stroke" text-anchor="start" dominant-baseline="middle">${escapeXml(g.label)}</text>`,
      );
    }
  }

  for (const s of d.simpul) {
    const bentuk = bentukSimpul(s);
    const rona = RONA_JENIS[s.jenis];
    bagian.push(
      `<path d="${bentuk.d}" fill="${bentuk.tanpaIsi ? "none" : isiTerang(rona)}" stroke="${bentuk.tanpaIsi ? "none" : rona}" stroke-width="1.6"/>`,
    );
    if (bentuk.tambahan) bagian.push(`<path d="${bentuk.tambahan}" fill="none" stroke="${rona}" stroke-width="1.6"/>`);
    const { baris, x, y0: ty } = tataTeks(s);
    const tspan = baris.map((l, i) => `<tspan x="${x}" y="${ty + i * TINGGI_BARIS}">${escapeXml(l)}</tspan>`).join("");
    bagian.push(`<text ${font} fill="#0B1A24" text-anchor="middle">${tspan}</text>`);
  }

  bagian.push("</svg>");
  return bagian.join("\n");
}
