"use client";
import SyroboKamar from "./SyroboKamar";
import { Taman, Pantai } from "./LatarAlam";
import { Angkasa, Salju } from "./LatarRuang";
import { Arcade, Laut } from "./LatarHiburan";
import { Istana } from "./LatarIstana";
import type { LatarProps } from "./LatarBersama";
import type { LatarId } from "@/lib/syrobo/syroboRules";

/**
 * Latar Main Room selain kamar bawaan. Tiap latar = satu adegan penuh layar dengan SATU FITUR UNIK yang bisa disentuh, ditambah satu
 * "saklar" bertema yang menggelapkan adegan = robot tidur, supaya cara menidurkan robot tetap sama di semua latar:
 *   taman   -> sentuh bunga (kecil tapi banyak): kuncup mekar + kupu-kupu terbang; lentera taman                  (LatarAlam.tsx)
 *   pantai  -> tekan MATAHARI = tidur (matahari tenggelam, bulan terbit, langit malam); payung di barisan depan (LatarAlam.tsx)
 *   angkasa -> gravitasi nol: benda melayang berfisika sungguhan (pantul, tumbukan), sentuh = dorong; panel lampu (LatarRuang.tsx)
 *   salju   -> sentuh perapian: lempar kayu, api berkobar + percikan; lentera gantung                            (LatarRuang.tsx)
 *   arcade  -> sentuh mesin arcade: kumpulkan skor sampai JACKPOT (koin berhamburan); papan neon OPEN          (LatarHiburan.tsx)
 *   laut    -> ikan berenang MENGHADAP arah renangnya; sentuh peti harta; ikan pancing bercahaya (lampu)      (LatarHiburan.tsx)
 *   istana  -> sentuh takhta: konfeti jatuh sampai lantai lalu memudar, robot bercahaya + suara (Premium)       (LatarIstana.tsx)
 * Kode bersama (defs, awan, lantai, saklar, penutup gelap) ada di LatarBersama.tsx; gaya CSS animasi `.lt-*` ada di globals.css.
 *
 * ATURAN PENEMPATAN (pemilik menolak benda melayang/salah letak): benda yang berdiri di lantai punya `bottom` tepat di sekitar garis
 * lantai (lantai mulai 62% dari atas = 38% dari bawah) dan kakinya tertanam; benda yang menumpang pada benda lain (lentera di payung/
 * tiang, kupu-kupu di bunga) DIGAMBAR DALAM satu pembungkus dengan induknya, supaya tak pernah meleset saat rasio layar berubah.
 * Pojok kiri atas & kanan atas dipakai HUD (status, poin), jadi benda penting tidak ditaruh di sana. Unsur alam digambar bergradasi
 * halus tanpa garis tinta tebal; prop buatan boleh bergaris tipis. Gerak: lapis perpindahan dan lapis gerak-dalam-badan DIPISAH
 * (ikan = renang X + goyang Y + ekor), titik putar di sambungan; transform CSS pada elemen SVG MENIMPA atribut transform-nya, jadi
 * posisi (atribut) dan animasi (kelas) selalu di <g> yang berbeda.
 * Ucapan benda lewat `bisik` (toast induk), seperti kamar. Benda hanya bisa disentuh bila sudah masuk DAN terang; saklarnya tetap bisa.
 */
export default function SyroboLatar({ id, gelap, ubahGelap, bisik, login = true, onTakhta }: { id: LatarId; gelap: boolean; ubahGelap: (g: boolean) => void; bisik: (teks: string) => void; login?: boolean; onTakhta?: () => void }) {
  const p: LatarProps = { gelap, ubahGelap, bisik, login, onTakhta };
  switch (id) {
    case "taman":
      return <Taman {...p} />;
    case "pantai":
      return <Pantai {...p} />;
    case "angkasa":
      return <Angkasa {...p} />;
    case "salju":
      return <Salju {...p} />;
    case "arcade":
      return <Arcade {...p} />;
    case "laut":
      return <Laut {...p} />;
    case "istana":
      return <Istana {...p} />;
    default:
      return <SyroboKamar gelap={gelap} ubahGelap={ubahGelap} bisik={bisik} login={login} />;
  }
}
