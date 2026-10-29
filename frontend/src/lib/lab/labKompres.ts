/**
 * Pemadatan teks untuk tautan lab: deflate-raw (CompressionStream, bawaan
 * browser & Node) → base64url. Dipakai flowchart (`?f=`) dan lab kode
 * (`?py=`, `?ps=`).
 *
 * Membuka padatan SELALU dibatasi ukuran hasilnya: tautan beberapa KB bisa
 * mengembang jadi ratusan MB (bom kompresi), dan tautan lab datang dari siapa
 * saja. Pemanggil yang menguji batas ini harus memakai muatan yang SAH
 * setelah dibuka — muatan rusak sudah gagal di tempat lain dan tidak
 * membuktikan apa-apa tentang batasnya.
 *
 * Modul netral; diuji `verify-flowchart` & `verify-kode`.
 */

export function keBase64Url(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function dariBase64Url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const biner = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(biner.length);
    for (let i = 0; i < biner.length; i++) out[i] = biner.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function aliran(data: Uint8Array, ubah: CompressionStream | DecompressionStream, batas: number): Promise<Uint8Array | null> {
  const tulis = ubah.writable.getWriter();
  void tulis.write(data as BufferSource).then(() => tulis.close()).catch(() => undefined);
  const baca = ubah.readable.getReader();
  const potong: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await baca.read();
    if (done) break;
    total += value.length;
    if (total > batas) {
      await baca.cancel().catch(() => undefined);
      return null;
    }
    potong.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of potong) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Teks → base64url(deflate-raw(UTF-8)). */
export async function padatkan(teks: string): Promise<string | null> {
  const padat = await aliran(new TextEncoder().encode(teks), new CompressionStream("deflate-raw"), Infinity);
  return padat ? keBase64Url(padat) : null;
}

/** Kebalikan `padatkan`; null bila rusak, bukan UTF-8 sah, atau hasilnya melebihi `batasByte`. */
export async function bukaPadatan(kode: string, batasByte: number): Promise<string | null> {
  const biner = dariBase64Url(kode);
  if (!biner) return null;
  try {
    const hasil = await aliran(biner, new DecompressionStream("deflate-raw"), batasByte);
    return hasil ? new TextDecoder("utf-8", { fatal: true }).decode(hasil) : null;
  } catch {
    return null;
  }
}
