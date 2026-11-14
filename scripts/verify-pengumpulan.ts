/**
 * Menguji logika tabel pengumpulan tugas pengajar (lib/pengumpulanTugas.ts):
 * saringan + hitungannya, pencarian, urutan, "siswa berikutnya yang perlu
 * dinilai", dan statistik nilai. Murni - tanpa dev server & kredensial.
 *
 *   npx tsx scripts/verify-pengumpulan.ts
 */
import { check, finish } from "./checks";
import {
  berikutnyaPerlu,
  cocokCari,
  cocokSaringan,
  hitungSaringan,
  statistikNilai,
  urutkan,
  type BarisPengumpulan,
} from "../frontend/src/lib/pengumpulanTugas";
import type { StatusTugas } from "../frontend/src/lib/classAssignmentRules";

function b(uid: string, nama: string, status: StatusTugas, extra: Partial<BarisPengumpulan> = {}): BarisPengumpulan {
  return {
    uid,
    nama,
    foto: null,
    status,
    keluar: false,
    dikirimIso: status === "belum" || status === "terlewat" ? null : "2026-10-19T01:00:00.000Z",
    dikirimTeks: null,
    dikirimLengkap: null,
    terlambat: status === "terlambat",
    nilai: null,
    ...extra,
  };
}

const daftar: BarisPengumpulan[] = [
  b("a", "Budi", "dinilai", { nilai: 80, dikirimIso: "2026-10-19T02:00:00.000Z" }),
  b("b", "alya", "dikumpulkan", { dikirimIso: "2026-10-19T03:00:00.000Z" }),
  b("c", "Ünal", "terlambat", { dikirimIso: "2026-10-20T03:00:00.000Z" }),
  b("d", "Citra", "belum"),
  b("e", "Dedi", "terlewat"),
  b("f", "Eka", "dinilai", { nilai: 95, terlambat: true, dikirimIso: "2026-10-18T03:00:00.000Z" }),
  b("g", "Fajar", "dinilai", { nilai: 60 }),
];

// ── Saringan ────────────────────────────────────────────────────────────
{
  const n = hitungSaringan(daftar);
  check("hitungan saringan", n.semua === 7 && n.perlu === 2 && n.dinilai === 3 && n.belum === 2 && n.terlambat === 2, JSON.stringify(n));
  check("'terlambat' juga memuat yang SUDAH dinilai", cocokSaringan(daftar[5], "terlambat") && daftar[5].status === "dinilai", "Eka");
  check("'perlu dinilai' = dikumpulkan + terlambat belum dinilai", daftar.filter((x) => cocokSaringan(x, "perlu")).map((x) => x.uid).join() === "b,c", "b,c");
  check("'belum' = belum + lewat tenggat", daftar.filter((x) => cocokSaringan(x, "belum")).map((x) => x.uid).join() === "d,e", "d,e");
}

// ── Pencarian ───────────────────────────────────────────────────────────
{
  check("cari tanpa beda huruf besar-kecil", cocokCari(daftar[1], "ALY"), "alya");
  check("cari tanpa tanda diakritik", cocokCari(daftar[2], "unal"), "Ünal");
  check("kata kosong cocok semua", daftar.every((x) => cocokCari(x, "  ")), "spasi");
  check("tak cocok ditolak", !cocokCari(daftar[0], "citra"), "Budi vs citra");
}

// ── Urutan ──────────────────────────────────────────────────────────────
{
  const ids = (u: Parameters<typeof urutkan>[1]) => urutkan(daftar, u).map((x) => x.uid).join("");
  check("urut status: perlu dinilai → dinilai → belum, seri menurut nama", ids("status") === "bcafgde", ids("status"));
  check("urut nama (A-Z, tanpa beda huruf besar-kecil)", ids("nama") === "badefgc", ids("nama"));
  check("urut waktu kirim: paling awal dulu, belum mengumpulkan di bawah", ids("kirim") === "fgabcde", ids("kirim"));
  check("nilai tertinggi: tanpa nilai di bawah", ids("nilaiTinggi") === "fagbdec", ids("nilaiTinggi"));
  check("nilai terendah: tanpa nilai TETAP di bawah", ids("nilaiRendah") === "gafbdec", ids("nilaiRendah"));
  check("urutkan tidak mengubah larik asli", daftar.map((x) => x.uid).join("") === "abcdefg", "salinan");
}

// ── Siswa berikutnya yang perlu dinilai ────────────────────────────────
{
  const urut = urutkan(daftar, "status"); // b c a f g d e
  check("berikutnya setelah b = c", berikutnyaPerlu(urut, "b")?.uid === "c", String(berikutnyaPerlu(urut, "b")?.uid));
  check("berputar ke awal: setelah c = b", berikutnyaPerlu(urut, "c")?.uid === "b", String(berikutnyaPerlu(urut, "c")?.uid));
  check("dari baris yang sudah dinilai tetap mencari ke depan", berikutnyaPerlu(urut, "f")?.uid === "b", String(berikutnyaPerlu(urut, "f")?.uid));
  check("baris sekarang tak pernah dikembalikan (baru disimpan, status belum diperbarui)", berikutnyaPerlu([daftar[1]], "b") === null, "satu-satunya");
  check("tidak ada yang perlu dinilai → null", berikutnyaPerlu(daftar.filter((x) => x.status === "dinilai"), "a") === null, "null");
  check("uid tak dikenal → mulai dari awal", berikutnyaPerlu(urut, "zzz")?.uid === "c" || berikutnyaPerlu(urut, "zzz")?.uid === "b", String(berikutnyaPerlu(urut, "zzz")?.uid));
}

// ── Statistik nilai ─────────────────────────────────────────────────────
{
  const s = statistikNilai([80, 95, 60, 59, 100, 70], 100)!;
  check("rata-rata dibulatkan 1 desimal", s.rata === 77.3, String(s.rata));
  check("tertinggi & terendah", s.tertinggi === 100 && s.terendah === 59, `${s.tertinggi}/${s.terendah}`);
  check("sebaran per kelompok (batas bawah inklusif)", s.sebaran.map((x) => x.jumlah).join() === "1,1,1,1,2", s.sebaran.map((x) => x.jumlah).join());
  check("jumlah sebaran = jumlah nilai", s.sebaran.reduce((a, x) => a + x.jumlah, 0) === s.jumlah && s.jumlah === 6, String(s.jumlah));
  const lima = statistikNilai([45, 30, 29], 50)!;
  check("nilai maksimal selain 100 dikelompokkan menurut persen", lima.sebaran.map((x) => x.jumlah).join() === "1,1,0,0,1", lima.sebaran.map((x) => x.jumlah).join());
  check("tanpa nilai → null", statistikNilai([], 100) === null, "null");
  check("nilai 0 tetap dihitung", statistikNilai([0], 100)?.sebaran[0].jumlah === 1, "0");
}

finish();
