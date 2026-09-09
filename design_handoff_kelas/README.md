# Handoff: Redesain Fitur Kelas (Classroom) — SynapEd

## Overview

Perombakan tampilan fitur Kelas di SynapEd: daftar kelas peserta (`/kelas`), ruang kelas (`/kelas/[id]`), panel pengelolaan educator (`/educator/classes`, `/educator/classes/[id]`, `.../members`). Struktur data, Server Action, dan aturan akses **tidak berubah sama sekali** — yang berubah hanya lapisan presentasi.

Tiga gagasan yang membedakannya dari tampilan sekarang:

1. **Tiap kelas punya identitas visual sendiri**, diturunkan dari namanya lewat hash — tanpa field baru di Firestore.
2. **Ruang kelas dibagi dua kolom**: umpan di kiri, panel informasi (ringkasan, anggota, kode undangan) di kanan.
3. **Lapisan gerak dari landing page dibawa masuk** ke halaman interior: `Reveal`, `CountUp`, `rise-in`, parallax benda melayang di hero, sapuan stabilo.

## About the Design Files

Berkas di bundel ini adalah **referensi desain yang ditulis dalam HTML** — prototipe yang menunjukkan tampilan dan perilaku yang dimaksud, **bukan kode produksi yang disalin mentah**. Tugasnya adalah **membangun ulang desain ini di dalam codebase SynapEd yang sudah ada**: Next.js 16 App Router + React Server Components + Tailwind v4, dengan token yang sudah hidup di `frontend/src/app/globals.css` dan komponen yang sudah ada di `frontend/src/components/`.

Jangan menyalin gaya inline dari berkas HTML. Setiap nilai di prototipe itu diambil dari token yang sudah ada — pakai kelas Tailwind-nya (`bg-paper-card`, `border-rule`, `text-ink-muted`, `shadow-soft`, `ease-out-soft`), bukan hex mentah.

## Fidelity

**High fidelity.** Warna, tipografi, jarak, radius, dan durasi transisi di prototipe sudah final dan seluruhnya berasal dari `globals.css`. Tidak ada satu pun warna atau font baru yang diperkenalkan. Bangun ulang setepat mungkin memakai kelas Tailwind yang memetakan ke token itu.

---

## Prasyarat: satu modul baru

### `frontend/src/lib/classColor.ts` (BARU)

Modul **netral** — tanpa `server-only`, tanpa `"use client"` — karena dipakai Server Component (daftar kelas) maupun Client Component. Pola yang sama dengan `classTypes.ts`.

```ts
/**
 * Warna kelas diturunkan dari NAMANYA, bukan dari field di Firestore.
 *
 * Alasannya sama dengan lessonsCount yang tidak disimpan: nilai turunan
 * yang ikut ditulis akan melenceng begitu namanya diganti. Dihitung ulang
 * setiap render, jadi tidak mungkin tidak sinkron — dan tidak ada migrasi
 * data untuk empat kelas yang sudah ada.
 */
export type NadaKelas = {
  /** Latar plate & chip. */
  tint: string;
  /** Teks/inisial di atas tint. */
  deep: string;
  /** Garis pemisah spine. */
  garis: string;
};

const NADA: NadaKelas[] = [
  { tint: "bg-blue-50",   deep: "text-blue-700",  garis: "border-blue-100" },
  { tint: "bg-amber-100", deep: "text-amber-700", garis: "border-amber-100" },
  { tint: "bg-rust-100",  deep: "text-rust-700",  garis: "border-rust-100" },
  { tint: "bg-navy",      deep: "text-paper",     garis: "border-navy" },
];

export function nadaKelas(nama: string): NadaKelas {
  let h = 0;
  for (let i = 0; i < nama.length; i++) h = (h * 31 + nama.charCodeAt(i)) >>> 0;
  return NADA[h % NADA.length];
}

export function inisialKelas(nama: string): string {
  return nama
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}
```

Catatan penting: kelasnya ditulis penuh (`"bg-blue-50"`), **bukan** dirangkai (`` `bg-${warna}-50` ``) — Tailwind memindai kode sebagai teks dan kelas yang dirangkai tidak akan ikut terbangun.

---

## Screens / Views

### 1. `/kelas` — Kelas Saya (peserta)

**Berkas**: `frontend/src/app/kelas/page.tsx`

**Purpose**: Peserta melihat kelas yang diikuti dan memasukkan kode undangan.

**Layout**

- Hero **full-bleed** menggantikan `<main className="bg-paper pt-32 pb-24">`. Hero memakai `bg-hero-navy` (`#0445d1`), `pt-32 pb-16`, `relative overflow-hidden`, dan `-mt-14` agar navbar mengambang di atasnya.
- Di bawahnya `container-page`, grid dua kolom: `grid-cols-[minmax(0,1fr)_minmax(260px,320px)] gap-9`, runtuh jadi satu kolom di bawah `900px` (`max-lg:grid-cols-1`).
- Kolom kiri: judul bagian + daftar kartu kelas (`flex flex-col gap-4`).
- Kolom kanan: panel gabung (`sticky top-24`).

**Hero — isi & gerak**

| Elemen | Spesifikasi |
|---|---|
| Latar | `bg-hero-navy` |
| Judul | Inter **800**, `clamp(2.4rem, 6.5vw, 5rem)`, `leading-[1.03]`, `tracking-[-0.04em]`, `text-paper` — **sama persis dengan `Hero.tsx`**, bukan `t-h2` |
| Kata "saya" | dibungkus `<span className="mark-on-dark">` (sapuan amber yang ditarik dari kiri, sudah ada di `globals.css`) |
| Tombol 1 | `Mulai/Gabung kelas baru →` — `bg-paper text-navy px-7 py-3.5 rounded-lg text-sm font-semibold`, hover `bg-white -translate-y-0.5 shadow-lift` |
| Tombol 2 | `Lanjutkan kelas terakhir` — `border border-white/25 text-paper`, hover `bg-white/10 border-white/50`, `whitespace-nowrap` |
| Masuk | tiap blok `.rise-in` dengan `--rise-delay` 60 / 170 / 300 / 400ms |

**Hero — benda melayang (parallax)**

Tiga aset yang sudah ada di `public/images`: `book.png`, `ruler.png`, `bottle.png`. Client Component kecil (`ClassHeroProps.tsx`) yang meniru `Hero.tsx`:

- `onMouseMove` pada hero → normalisasi posisi kursor ke `-1..1`.
- Pengali kedalaman: buku `x*24, y*15`; penggaris `x*32, y*19`; botol `x*40, y*24`.
- Rotasi: `mouse.x * 6 + offset` (buku `-8deg`, penggaris `+12deg`, botol `-10deg`).
- Transisi `transform 650ms cubic-bezier(.22,1,.36,1)`.
- Tiap benda dibungkus `animate-float-bob-left` / `animate-float-bob-right` (sudah ada di `globals.css`).
- Posisi: buku `left-[14%] top-[16%]`, penggaris `right-[7%] top-[12%]`, botol `right-[19%] top-[58%]`.
- `pointer-events-none select-none`, dan **`hidden max-lg:hidden` di bawah 900px** — di layar sempit benda ini menutupi judul.
- Ukuran: `clamp(80px,9vw,140px)` / `clamp(92px,11vw,168px)` / `clamp(68px,7.5vw,118px)`, `drop-shadow-2xl`.

**Navbar mengikuti hero**

`Navbar.tsx` sudah punya mekanismenya (`overDarkHero`, `NAVBAR_MID = 48`), tapi saat ini hanya mengukur `#hero` dan hanya di beranda. Perluas: ukur elemen hero gelap mana pun di halaman (mis. `[data-dark-hero]`), bukan `isHome`. Tanpa ini, logo putih akan tergambar di atas kertas krem begitu hero terlewat.

**Kartu kelas**

```
┌────┬─────────────────────────────────────────────┐
│ NT │ Neurosains Terapan 2026    [PESERTA]        │  spine 88px
│    │ Kelas pendamping untuk peserta…             │
│    │ ─────────────────────────────────────────── │
│    │ 24 anggota  8 postingan  Dibuat 12 Feb 2026 │
└────┴─────────────────────────────────────────────┘
```

- Pembungkus: `bg-paper-card border border-rule rounded-2xl overflow-hidden flex`, hover `border-rule-strong shadow-lift -translate-y-[3px]`, transisi `240ms ease-out-soft`.
- **Spine** kiri: lebar `88px` (`14px` di mobile), `bg` dan `border-r` dari `nadaKelas(nama)`, berisi inisial Fraunces `34px`, `font-variation-settings: "opsz" 72, "SOFT" 30, "WONK" 1`.
- Judul: Fraunces `21px/1.3`, `font-weight 500`, `opsz 24, SOFT 25, WONK 0` — setara `t-h3` sedikit lebih kecil.
- Chip peran: `Tag` yang sudah ada, tone mengikuti nada kelas.
- Deskripsi: `text-sm/1.65 text-ink-body max-w-[64ch]`, `line-clamp-2`.
- Baris figur: dipisah `border-t border-rule pt-3.5`, angka Fraunces `19px` dengan `font-feature-settings:"tnum"`, label `text-[13px] text-ink-muted`. **Bukan** kalimat bertitik-titik seperti sekarang.
- Seluruh kartu dibungkus `<Reveal variant="tilt" delay={i * 110}>`.

**Panel gabung** (kolom kanan, `sticky top-24`)

- `bg-paper-card border border-rule rounded-2xl p-6`.
- Kicker `t-label text-ink-muted` "Gabung kelas", judul Fraunces `20px` "Punya kode dari pengajar?".
- Input: **lebar penuh, rata tengah**, `font-mono text-xl tracking-[0.24em]`, `bg-paper border border-rule-strong rounded-lg px-4 py-3.5`, fokus `border-blue-500 ring-2 ring-blue-500/25`. Normalisasi saat diketik tetap pakai `normalizeInviteCode` yang sudah ada.
- Tombol `Gabung kelas` lebar penuh, `bg-blue-600`, nonaktif `opacity-60` selama panjang < 8.
- Kartu kedua bergaris putus-putus: `border border-dashed border-rule-strong rounded-2xl p-5 bg-paper-card/50`, isi "Belum punya kode?".

**Kondisi kosong** (menggantikan kotak abu satu kalimat)

`border border-dashed border-rule-strong rounded-2xl bg-paper-card/55 py-14 px-8 text-center`; ikon kotak `64px rounded-[18px] bg-paper-alt border border-rule`; judul Fraunces `22px`; penjelasan `max-w-[44ch] text-sm/1.7 text-ink-muted` yang menyebut **langkah berikutnya**, bukan sekadar "kosong".

---

### 2. `/kelas/[id]` — Ruang kelas (peserta)

**Berkas**: `frontend/src/app/kelas/[id]/page.tsx`, `components/classes/PostFeed.tsx`, `ReplyForm.tsx`

**Hero**: `bg-navy` (`#142A56`) full-bleed, `pt-24`, dengan dua kilau radial `pointer-events-none`:
`radial-gradient(circle, rgba(37,99,235,.55), transparent 62%)` di kanan atas (520px) dan `rgba(217,154,43,.18)` di kiri bawah (460px).

Isi hero:
- Tautan balik `← Kelas Saya`, `text-[13px] text-paper/70`.
- **Plate identitas kelas** `92×92`, `rounded-[20px]`, kaca biru: `linear-gradient(155deg, var(--color-blue-100)/55%, var(--color-blue-300)/30%)`, `backdrop-blur-[22px] saturate-180`, `border border-blue-300/55`, `shadow-lift` + `0 0 46px -18px var(--color-blue-500)/55`. Di dalamnya cincin `holo` (conic-gradient biru berputar 10s, salinan `.feature-card__holo`) dan `glare`. Inisial Fraunces `36px` warna `text-navy`. Pembungkusnya `.drift`.
- Judul kelas Fraunces `clamp(2rem,4.4vw,3.1rem)` `text-paper`, dibungkus `.mark-on-dark`.
- Deskripsi `text-paper/78 max-w-[58ch]`.
- Kartu pengajar di kanan: avatar `44px bg-white/12 border-white/28` + label.
- Masuk berjenjang `.rise-in` 0/120/220/320/420ms.

**Tab** menempel di dasar hero, `rounded-t-xl px-[22px] py-3 text-sm font-semibold`:
aktif `bg-paper text-blue-700`, tidak aktif `bg-paper/10 text-paper/72`.
Tiga tab: **Pengumuman · Anggota · Tentang**. (Label "Umpan" ditolak; pakai "Pengumuman".)

**Kolom umpan**

- Kartu postingan: `bg-paper-card border border-rule rounded-2xl p-6`, hover `border-rule-strong shadow-soft`.
- Baris kepala: `UserAvatar` 40px · nama `text-sm font-semibold text-ink` · `Tag tone="blue"` Pengajar · tanggal `ml-auto text-[13px] text-ink-muted`.
- Badan: `text-[15.5px]/1.75 text-ink-body whitespace-pre-line`. **Naik dari 14px** — ini badan tulisan pengajar, bukan metadata.
- Balasan: `border-t border-rule pt-[18px]`, label `t-label text-ink-muted` (`"2 balasan"` / `"Belum ada balasan"`), lalu daftar dengan **rel kiri** `border-l-2 border-blue-100 pl-[18px]`, avatar 32px berwarna dari `nadaKelas(nama penulis)`.
- Kotak balasan: baris pil — avatar 32px + `input rounded-full bg-paper border-rule px-[18px] py-2.5` + tombol `Balas` pil bergaris. Tetap **selalu terlihat**, sesuai catatan di `ReplyForm.tsx`.

**Panel kanan** (`sticky top-24`, `w-80`)

1. **Ringkasan** — tiga baris `label kiri / angka Fraunces 17px tnum kanan`, dipisah `divide-y divide-rule`; di bawahnya tumpukan avatar (`-ml-[9px]`, `border-2 border-paper-card`) + `+21` + tautan "Lihat semua" yang memindahkan tab ke Anggota.
2. **Kursus terkait** — *placeholder*. Belum ada field yang menghubungkan kelas ke kursus; jangan tampilkan sampai relasinya ada.
3. Tautan `Keluar dari kelas` — `text-[13px] text-ink-muted`, hover `text-rust-700`, tetap lewat `ConfirmDialog` yang ada.

**Tab Anggota**: satu kartu, baris `divide-y divide-rule`, baris pertama pemilik kelas dengan latar `bg-paper` dan `Tag` Pengajar. Baris hover `bg-paper`.

---

### 3. `/educator/classes` — Panel Educator

**Berkas**: `frontend/src/app/educator/classes/page.tsx`, `components/classes/ClassForm.tsx`

- Header band `bg-paper-alt border-b border-rule pt-24 pb-10` (bukan hero navy — ini ruang kerja, bukan halaman sambutan). `chapter-mark` "Panel Educator", judul Fraunces dengan `.mark` pada kata "kelola".
- Grid dua kolom sama seperti `/kelas`.
- **Baris kelas** kiri: spine tipis `14px` berwarna nada kelas, nama Fraunces 20px, **kode undangan tampil langsung di baris** sebagai `<code>` kecil (`border border-rule bg-paper-alt rounded-md px-2 py-0.5 text-xs tracking-[0.12em]`) — pengajar paling sering ke sini justru untuk itu. Dua tombol: `Buka` (`bg-blue-50 border-blue-100 text-blue-700`) dan `Anggota` (bergaris netral).
- **Form buat kelas** di kolom kanan, `sticky top-24` — tetap satu halaman, tanpa rute `/baru`, sesuai keputusan yang sudah tercatat di kode.
- Kondisi kosong: kotak bergaris putus-putus, "Belum ada kelas — buat satu, lalu bagikan kode undangannya."

### 4. `/educator/classes/[id]` — Ruang kelas (pengelola)

Sama dengan (2), ditambah:
- **Composer di puncak umpan** (bukan di atas kode undangan): avatar 40px + `textarea rounded-xl bg-paper` 3 baris + baris kaki `sisa karakter` / tombol `Kirim ke kelas`.
- **Kartu kode undangan** pindah ke panel kanan, `border-rule-strong` (satu langkah lebih tegas dari kartu lain): kode `font-mono 24px tracking-[0.22em]` di atas `bg-paper-alt rounded-xl py-4 text-center`, dua tombol grid `Salin` / `Ganti kode`, lalu peringatan dengan titik amber `14px` di depannya. Teks peringatan dipertahankan apa adanya.
- Tombol `Hapus` pada tiap postingan dan balasan, `text-[13px] text-ink-muted` hover `text-rust-700`.

---

## Interactions & Behavior

| Interaksi | Perilaku |
|---|---|
| Hover kartu kelas | `-translate-y-[3px]`, `shadow-lift`, `border-rule-strong`, 240ms `ease-out-soft` |
| Masuk layar | `Reveal` (fade+naik 800ms `ease-warm`, threshold 0.12, `rootMargin 0 0 -8% 0`); kartu kelas pakai `variant="tilt"`, jeda `i*110ms`; kartu umpan jeda `i*90ms` |
| Angka statistik | `CountUp` yang sudah ada — 1400ms, ease-out kubik |
| Hero masuk | `.rise-in` berjenjang |
| Parallax | hanya di hero `/kelas`, dimatikan di bawah 900px dan saat `prefers-reduced-motion` |
| Salin kode | label berubah `Salin → Tersalin` 2 detik; kegagalan `navigator.clipboard` **tidak boleh** membuat panel tampak rusak (kode tetap terbaca) |
| Ganti kode / hapus / keluar | tetap lewat `ConfirmDialog` |
| Fokus input | `border-blue-500 ring-2 ring-blue-500/25` |
| Reduced motion | seluruh `.reveal`, `.rise-in`, `.drift`, `.animate-float-bob-*`, `.holo` dimatikan; konten tetap `opacity:1` |

**Responsif**

- `< 900px`: grid dua kolom → satu kolom, `gap-6`; panel kanan turun ke bawah dan `position: static` (sticky di kolom yang menumpuk membuat kartu menempel aneh); benda melayang hero disembunyikan.
- `< 600px`: padding tepi `24px → 16px`; hero `pt-26 pb-10`.
- Judul hero sudah `clamp`, tidak perlu penanganan terpisah.

## State Management

Tidak ada state server baru. Yang ada semuanya lokal di Client Component yang sudah ada:

- `JoinClassForm`: `code`, `pending`, `error` — tidak berubah.
- `PostComposer`: `body`, `pending`, `error` — tidak berubah.
- `JoinCodePanel`: `tersalin`, `open`, `pending`, `error` — tidak berubah.
- **Baru (opsional)**: `tab` di ruang kelas (`"pengumuman" | "anggota" | "tentang"`). Bisa jadi state klien, atau `?tab=` di URL supaya bisa ditautkan langsung. Kalau memakai state klien, daftar anggota perlu ikut dikirim dari server — `listClassMembers` + `getUserCards` sudah ada, tinggal dipanggil di halaman peserta juga. **Perhatikan**: halaman peserta saat ini sengaja tidak memuat daftar anggota; menampilkannya adalah keputusan produk, bukan sekadar tampilan. Kalau belum disetujui, cukup tautkan ke halaman anggota educator untuk pemilik dan sembunyikan tab itu untuk peserta.

## Design Tokens

Semua sudah ada di `frontend/src/app/globals.css`. Tidak ada yang baru.

| Peran | Token | Nilai |
|---|---|---|
| Latar halaman | `--color-paper` | `#FCF9F4` |
| Latar selang-seling | `--color-paper-alt` | `#F5F0E7` |
| Kartu | `--color-paper-card` | `#FFFFFF` |
| Garis | `--color-rule` / `--color-rule-strong` | `#E7DED0` / `#D8CBB6` |
| Judul | `--color-ink` | `#23201C` |
| Isi | `--color-ink-body` | `#57504A` |
| Caption | `--color-ink-muted` | `#6E655C` |
| Dekoratif (bukan teks) | `--color-ink-faint` | `#A99F95` |
| Identitas | `--color-blue-500/600/700` | `#2563EB` / `#1D4FD0` / `#1A3F9E` |
| Tint biru | `--color-blue-50/100/300` | `#EDF2FE` / `#DCE6FD` / `#8FAEF8` |
| Permukaan gelap | `--color-navy`, `.bg-hero-navy` | `#142A56`, `#0445d1` |
| Stabilo | `--color-amber-100/500/700` | `#FBEBCB` / `#D99A2B` / `#8A5C0C` |
| Peringatan | `--color-rust-100/700` | `#F6E2D9` / `#8F4326` |
| Bayangan | `--shadow-soft` / `--shadow-lift` | lihat `globals.css` |
| Easing | `--ease-out-soft` / `--ease-warm` | interaksi / reveal |

**Radius**: chip `rounded-md` 6 · tombol & input `rounded-lg` 8 · kartu `rounded-2xl` 16 · plate & panel besar `rounded-3xl` 24 · pil `rounded-full`. Jangan melebihi `rounded-3xl`.

**Tipografi**: Fraunces hanya ≥ `1.25rem` (judul, angka, inisial); Inter untuk seluruh badan teks dan antarmuka. Angka yang berdiri sebagai figur selalu `font-feature-settings:"tnum"`.

**Peringatan kontras**: `--color-ink-faint` ditandai DEKORATIF di `globals.css`. Label kecil (`t-label`) **harus** `text-ink-muted`, bukan `ink-faint` — 11.5px `#A99F95` di atas kartu putih hanya 2,6:1. Satu-satunya pemakaian sah `ink-faint` adalah `.chapter-mark` dan placeholder input.

## Assets

Semuanya sudah ada di `frontend/public/images/` — tidak ada aset baru:

- `book.png`, `ruler.png`, `bottle.png` — benda melayang hero (dipakai ulang dari `Hero.tsx`)
- `logotext.png`, `logotextwhite.png` — logo navbar terang/gelap

Ikon: prototipe tidak menggambar ikon baru. Kalau nanti perlu (mis. QR kode undangan), ikuti pola SVG inline `strokeWidth={1.75}` seperti di `Navbar.tsx`.

## Komponen yang dipakai ulang (jangan tulis ulang)

`components/ui/Reveal.tsx` · `CountUp.tsx` · `UserAvatar.tsx` · `Tag.tsx` · `ProfileLink.tsx` · `Card.tsx` · `Button.tsx` · `ConfirmDialog.tsx` · `components/educator/fields.tsx` (`Label`, `inputClass`) · `lib/inviteCode.ts` · `lib/cn.ts`

## Files

Prototipe ada di bundel ini:

- `Kelas - Prototipe Interaktif.dc.html` — **acuan utama**. Prototipe hidup: klik kartu untuk masuk kelas, ganti peran Peserta/Pengelola di kanan atas, tulis postingan, balas, salin/ganti kode, buat kelas baru, dan kosongkan daftar untuk melihat kondisi kosong.
- `Kelas - Desain Baru.dc.html` — lima layar statis (desktop + mobile) untuk mengukur tata letak.
- `Kelas - Tampilan Sekarang.dc.html` — rekonstruksi tampilan lama, untuk pembanding.

Buka ketiganya langsung di browser. Berkas `support.js` dan folder `frontend/public/images` harus ikut agar gambar dan runtime-nya jalan.

## Urutan yang disarankan

1. `lib/classColor.ts` + komponen kecil `ClassPlate` (spine/plate + inisial).
2. `/kelas` — hero, kartu kelas, panel gabung, kondisi kosong.
3. `Navbar.tsx` — perluas deteksi hero gelap agar tidak hanya beranda.
4. `/kelas/[id]` — hero navy, dua kolom, `PostFeed` dan `ReplyForm` yang dirapikan.
5. `/educator/classes` dan `/educator/classes/[id]`.
6. Responsif dan `prefers-reduced-motion` — periksa di 375, 600, 900, 1440.

Setelah selesai, `npm run verify:classroom` harus tetap hijau: seluruh perubahan bersifat presentasi, jadi kode undangan, postingan, dan balasan wajib berperilaku persis seperti sebelumnya.
