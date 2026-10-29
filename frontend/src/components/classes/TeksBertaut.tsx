import { pecahTeksTautan } from "@/lib/linkify";

/**
 * Teks polos dengan alamat web yang bisa diklik. Tetap TANPA markup: yang diubah
 * hanya `http(s)://…` dan `www.…` (lihat lib/linkify.ts untuk aturannya).
 *
 * Tautan dibuka di tab baru dengan `noopener noreferrer`: tulisan pengajar/peserta
 * adalah masukan pengguna, jadi halaman tujuan tak boleh mendapat akses ke jendela
 * SynapEd (`opener`) maupun alamat halaman ini. `nofollow ugc` menandainya sebagai
 * konten buatan pengguna. Tanpa hook: aman di komponen server maupun klien.
 */
export default function TeksBertaut({ teks }: { teks: string }) {
  return (
    <>
      {pecahTeksTautan(teks).map((p, i) =>
        p.jenis === "teks" ? (
          p.isi
        ) : (
          <a
            key={i}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="break-all font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-[3px] transition-colors duration-200 hover:text-blue-300 hover:decoration-blue-300"
          >
            {p.isi}
          </a>
        ),
      )}
    </>
  );
}
