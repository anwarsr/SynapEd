/**
 * Contoh Python siap pakai untuk Lab 04 — sepadan dengan contoh pseudocode
 * supaya guru bisa membandingkan keduanya berdampingan.
 *
 * Keluaran harapan tiap contoh dijaga uji browser (Pyodide tidak berjalan di
 * suite murni).
 *
 * Modul netral.
 */
import type { ContohKode } from "../kodeTypes";

export const CONTOH_PYTHON: readonly ContohKode[] = [
  {
    id: "luas",
    nama: "Luas persegi panjang",
    ket: "input(), int(), dan print dengan f-string.",
    masukan: "4\n5",
    kode: `# Menghitung luas persegi panjang
panjang = int(input("Panjang: "))
lebar = int(input("Lebar: "))
luas = panjang * lebar
print(f"Luas = {luas}")
`,
  },
  {
    id: "genap",
    nama: "Genap atau ganjil",
    ket: "if / else dengan operator sisa bagi %.",
    masukan: "7",
    kode: `angka = int(input("Angka: "))
if angka % 2 == 0:
    print(angka, "adalah bilangan genap")
else:
    print(angka, "adalah bilangan ganjil")
`,
  },
  {
    id: "jumlah",
    nama: "Jumlah 1 sampai n",
    ket: "Perulangan for dengan range().",
    masukan: "5",
    kode: `n = int(input("n: "))
total = 0
for i in range(1, n + 1):
    total = total + i
print("Jumlah 1 sampai", n, "=", total)
`,
  },
  {
    id: "terbesar",
    nama: "Nilai terbesar dalam list",
    ket: "List, perulangan, dan perbandingan.",
    masukan: "",
    kode: `data = [12, 7, 31, 4, 19]
terbesar = data[0]
for nilai in data:
    if nilai > terbesar:
        terbesar = nilai
print("Nilai terbesar:", terbesar)
`,
  },
  {
    id: "validasi",
    nama: "Validasi masukan",
    ket: "while: minta ulang sampai masukannya sah.",
    masukan: "0\n15\n7",
    kode: `pilihan = int(input("Angka 1-10: "))
while pilihan < 1 or pilihan > 10:
    print("Di luar rentang, coba lagi.")
    pilihan = int(input("Angka 1-10: "))
print("Terima kasih, Anda memilih", pilihan)
`,
  },
  {
    id: "faktorial",
    nama: "Faktorial (rekursif)",
    ket: "Fungsi yang memanggil dirinya sendiri.",
    masukan: "5",
    kode: `def faktorial(n):
    if n <= 1:
        return 1
    return n * faktorial(n - 1)

angka = int(input("Angka: "))
print(f"{angka}! = {faktorial(angka)}")
`,
  },
  {
    id: "huruf",
    nama: "Menghitung huruf",
    ket: "Dictionary: berapa kali tiap huruf muncul.",
    masukan: "banana",
    kode: `kata = input("Kata: ")
hitung = {}
for huruf in kata:
    hitung[huruf] = hitung.get(huruf, 0) + 1
for huruf, jumlah in hitung.items():
    print(huruf, jumlah)
`,
  },
];
