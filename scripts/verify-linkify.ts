/**
 * Menguji pengubah tautan teks pengumuman (murni, tanpa server): hanya alamat web
 * yang aman jadi tautan, tanda baca kalimat tidak ikut, dan skema berbahaya tidak
 * pernah dikenali.
 *
 *   npx tsx scripts/verify-linkify.ts
 */
import { check, finish } from "./checks";
import { pecahTeksTautan } from "../frontend/src/lib/linkify";

const tautan = (t: string) => pecahTeksTautan(t).filter((p) => p.jenis === "tautan");
const gabung = (t: string) => pecahTeksTautan(t).map((p) => p.isi).join("");

console.log("\nTautan di teks pengumuman (murni)\n");

check("teks tanpa alamat tetap utuh", JSON.stringify(pecahTeksTautan("Halo kelas")) === JSON.stringify([{ jenis: "teks", isi: "Halo kelas" }]), "satu potongan");
check("teks kosong", pecahTeksTautan("").length === 0, "kosong");

const a = pecahTeksTautan("Baca di https://synapedu.com/kursus sekarang");
check("https dikenali di tengah kalimat", a.length === 3 && a[1].jenis === "tautan" && a[1].isi === "https://synapedu.com/kursus", a.map((p) => p.isi).join("|"));
check("http dikenali", tautan("lihat http://contoh.id/a")[0]?.href === "http://contoh.id/a", "http");
check("www. diberi https://", tautan("buka www.contoh.id/x")[0]?.href === "https://www.contoh.id/x", String(tautan("buka www.contoh.id/x")[0]?.href));
check("teks asli tak berubah (gabungan potongan = masukan)", ["Tugas: https://a.id/x, lalu www.b.id.", "(https://a.id/b)", "a https://x.id\nb https://y.id"].every((t) => gabung(t) === t), "tanpa kehilangan karakter");

check("titik di ujung kalimat tidak ikut", tautan("Lihat https://a.id/x.")[0]?.isi === "https://a.id/x", String(tautan("Lihat https://a.id/x.")[0]?.isi));
check("koma/titik dua/seru tidak ikut", tautan("a https://a.id/x, b")[0]?.isi === "https://a.id/x" && tautan("https://a.id/x!")[0]?.isi === "https://a.id/x", "tanda baca");
check("kurung penutup yang tak berpasangan dipangkas", tautan("(lihat https://a.id/x)")[0]?.isi === "https://a.id/x", String(tautan("(lihat https://a.id/x)")[0]?.isi));
check("kurung berpasangan di dalam alamat dipertahankan", tautan("https://id.wikipedia.org/wiki/Aljabar_(matematika)")[0]?.isi === "https://id.wikipedia.org/wiki/Aljabar_(matematika)", "wikipedia");
check("query & fragmen dipertahankan", tautan("https://a.id/p?q=1&r=2#bag")[0]?.href === "https://a.id/p?q=1&r=2#bag", "query");
check("beberapa alamat dalam satu teks", tautan("https://a.id dan https://b.id").length === 2, "dua");
check("alamat di baris baru terpisah benar", tautan("a\nhttps://a.id\nb").length === 1 && tautan("a\nhttps://a.id\nb")[0].isi === "https://a.id", "baris baru");

check("javascript: tidak pernah jadi tautan", tautan("klik javascript:alert(1)").length === 0, "ditolak");
check("data: tidak pernah jadi tautan", tautan("data:text/html,<script>alert(1)</script>").length === 0, "ditolak");
check("alamat mengandung javascript: di dalam path tetap http(s) biasa", tautan("https://a.id/javascript:x")[0]?.href === "https://a.id/javascript:x", "hanya skema yang dinilai");
check("host tanpa titik ditolak", tautan("http://localhost/x").length === 0 && tautan("https://intranet/x").length === 0, "bukan domain");
check("kredensial di alamat ditolak (penyamaran)", tautan("https://bank.com@jahat.example").length === 0 && tautan("https://u:p@a.id").length === 0, "userinfo");
check("host berujung titik / diawali titik ditolak", tautan("https://.a.id").length === 0, "host rusak");
check("tanda kutip/kurung sudut memutus alamat", tautan('<a href="https://a.id/x">')[0]?.isi === "https://a.id/x", String(tautan('<a href="https://a.id/x">')[0]?.isi));
check("teks HTML tetap teks (tak ditafsirkan)", pecahTeksTautan("<script>alert(1)</script>").every((p) => p.jenis === "teks"), "tanpa markup");
check("kata biasa berawalan www tanpa titik bukan tautan", tautan("wwwx contoh").length === 0, "bukan alamat");

finish();
