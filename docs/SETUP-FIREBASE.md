# Menghubungkan SynapEd ke Firebase

Panduan langkah demi langkah dari nol sampai aplikasi hidup di internet.

Perkiraan waktu **30–45 menit**. Anda butuh akun Google dan kartu kredit/debit
(untuk verifikasi Blaze — penjelasan di Langkah 2).

Setelah tiap langkah penting ada perintah pemeriksaan:

```bash
npm run check
```

Perintah itu hanya **membaca**, tidak mengubah apa pun, dan memberi tahu persis
apa yang masih kurang.

---

## Ringkasan alur

```
1. Buat proyek Firebase
2. Aktifkan paket Blaze
3. Aktifkan Authentication (Email/Password)
4. Buat database Firestore
5. Aktifkan Storage
6. Daftarkan aplikasi Web  -> dapat konfigurasi
7. Isi frontend/.env.local + .firebaserc
8. Kredensial skrip        -> gcloud ADC (atau service account)
9. Login Firebase CLI & pasang aturan keamanan
10. Isi data + pindahkan akun
11. Uji lokal terhadap proyek asli
12. Deploy
```

---

## Langkah 1 — Buat proyek Firebase

1. Buka <https://console.firebase.google.com>, masuk dengan akun Google Anda.
2. Klik **Create a project** / **Buat proyek**.
3. Nama proyek: `synaped` (bebas). Firebase akan menambahkan akhiran acak bila
   nama itu sudah dipakai orang lain — misalnya `synaped-a1b2c`.
4. Google Analytics boleh **dimatikan** — tidak dipakai proyek ini.
5. Tunggu sampai selesai, lalu klik **Continue**.

**Catat Project ID Anda.** Bukan nama proyek — **Project ID**. Lihat di
**⚙ Project settings → General → Project ID**. Bentuknya huruf kecil dan
tanda hubung, misalnya `synaped-a1b2c`. Nilai ini dipakai berkali-kali nanti.

---

## Langkah 2 — Aktifkan paket Blaze

**Kenapa perlu:** Firebase App Hosting (yang menjalankan Next.js) hanya
tersedia di paket Blaze. Paket gratis Spark tidak menyediakannya.

**Apakah langsung ditagih?** Tidak. Blaze itu *pay-as-you-go* dan **tetap
mempertahankan kuota gratis** yang sama. Anda baru ditagih setelah melampaui
kuota tersebut. Untuk trafik skala skripsi/demo, tagihan biasanya **Rp 0**.

1. Di sidebar kiri bawah klik **Upgrade** / ikon roda gigi → **Usage and billing**.
2. Pilih **Blaze — Pay as you go**.
3. Ikuti proses penautan akun billing (perlu kartu).
4. **Sangat disarankan:** setel **Budget alert**. Di halaman billing cari
   **Budgets & alerts** → buat anggaran misalnya **Rp 50.000** dengan notifikasi
   email di 50%, 90%, 100%. Ini tidak menghentikan layanan secara otomatis,
   tetapi Anda akan tahu lebih awal bila ada yang tidak wajar.

> Kalau Anda **belum siap** memakai kartu: proyek ini tetap bisa dijalankan
> penuh di emulator lokal (gratis, offline). Yang belum bisa hanyalah membuatnya
> diakses lewat internet.

---

## Langkah 3 — Aktifkan Authentication

1. Sidebar kiri → **Build → Authentication**.
2. Klik **Get started**.
3. Tab **Sign-in method** → pilih **Email/Password**.
4. Aktifkan sakelar **Enable** yang pertama.
   Sakelar kedua (*Email link / passwordless*) **biarkan mati**.
5. Klik **Save**.

---

## Langkah 4 — Buat database Firestore

1. Sidebar kiri → **Build → Firestore Database**.
2. Klik **Create database**.
3. **Location:** pilih `asia-southeast2` (Jakarta) atau `asia-southeast1`
   (Singapura) agar dekat dengan pengguna Indonesia.
   **Lokasi ini tidak bisa diubah setelah dibuat** — pilih dengan yakin.
4. Mode keamanan: pilih **Start in production mode** (menolak semua akses).
   Jangan khawatir — aturan yang benar akan dipasang di Langkah 9.
5. Klik **Create**.

---

## Langkah 5 — Aktifkan Storage

Ini tempat berkas PDF/DOCX disimpan.

1. Sidebar kiri → **Build → Storage**.
2. Klik **Get started**.
3. Pilih **Start in production mode**, lalu **Next**.
4. Lokasi mengikuti Firestore secara otomatis. Klik **Done**.
5. **Catat nama bucket** yang muncul di bagian atas, bentuknya seperti
   `synaped-a1b2c.firebasestorage.app` atau `synaped-a1b2c.appspot.com`.
   Salin **persis** seperti yang tertulis — dua akhiran itu berbeda dan
   proyek baru biasanya memakai `.firebasestorage.app`.

---

## Langkah 6 — Daftarkan aplikasi Web

1. **⚙ Project settings → General**.
2. Gulir ke **Your apps** → klik ikon **`</>`** (Web).
3. App nickname: `synaped-web`. **Jangan** centang Firebase Hosting.
4. Klik **Register app**.
5. Muncul potongan kode berisi objek `firebaseConfig`. **Jangan tutup dulu.**

Isinya kurang lebih:

```js
const firebaseConfig = {
  apiKey: "AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "synaped-a1b2c.firebaseapp.com",
  projectId: "synaped-a1b2c",
  storageBucket: "synaped-a1b2c.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456"
};
```

> **`apiKey` bukan rahasia.** Ia memang dirancang untuk terlihat publik di
> browser. Yang menjaga data Anda adalah *security rules* (Langkah 9), bukan
> kunci ini. Yang **benar-benar rahasia** adalah service account di Langkah 8.

---

## Langkah 7 — Isi konfigurasi

### 7a. `frontend/.env.local`

Buka berkas itu (buat dari `.env.example` bila belum ada) dan ganti isinya
menjadi — sesuaikan dengan nilai Anda sendiri:

```ini
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_FIREBASE_PROJECT_ID=synaped-a1b2c
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=synaped-a1b2c.firebaseapp.com
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=synaped-a1b2c.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123def456
```

**Tiga hal yang paling sering salah:**

| Kesalahan | Akibat |
|---|---|
| Lupa mengubah `USE_FIREBASE_EMULATOR` jadi `false` | Aplikasi tetap menunjuk emulator, proyek asli tidak tersentuh |
| Baris `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` masih ada | Sama seperti di atas — **hapus kedua baris itu** |
| `storageBucket` ditebak, bukan disalin | Unduhan lampiran gagal 404 |

### 7b. `.firebaserc`

Di folder root, ganti `demo-synaped` dengan Project ID Anda:

```json
{
  "projects": {
    "default": "synaped-a1b2c"
  }
}
```

Nilainya **harus sama persis** dengan `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

### Periksa

```bash
npm run check
```

Bagian 1–4 harus hijau. Bagian 5 masih gagal — itu wajar, service account
belum ada.

---

## Langkah 8 — Kredensial untuk skrip

Skrip migrasi memakai Admin SDK, yang butuh kredensial. Ada dua cara.

### Cara A — gcloud (disarankan, tanpa berkas kunci)

Kalau Google Cloud SDK sudah terpasang:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project <PROJECT_ID>
```

Pilih akun Google yang memiliki proyek ini. Selesai — tidak ada berkas kunci
berumur panjang di disk, jadi tidak ada yang bisa bocor.

> Perintah `set-quota-project` **wajib**. Tanpa itu, API Authentication menolak
> dengan pesan *"requires a quota project, which is not set by default"*.

### Cara B — service account (kalau gcloud tidak ada)

1. **⚙ Project settings → Service accounts**.
2. Klik **Generate new private key** → **Generate key**.
3. Simpan berkas `.json` **di luar folder proyek**.

> **Ini benar-benar rahasia.** Siapa pun yang memilikinya dapat membaca dan
> menghapus seluruh database Anda, menembus semua security rules. Jangan
> pernah di-commit atau dikirim lewat chat. Kalau bocor: hapus kuncinya di
> halaman yang sama.

Muat ke sesi terminal. **Hanya berlaku di jendela terminal itu:**

```powershell
$env:FIREBASE_SERVICE_ACCOUNT = Get-Content "C:\path\firebase-key.json" -Raw
```

### Periksa

```bash
npm run check
```

Sekarang bagian 5 harus tersambung. Firestore dan Authentication akan
melaporkan **0** — itu benar, isinya memang belum ada.

---

## Langkah 9 — Login CLI & pasang aturan keamanan

```bash
npx firebase login
```

Browser terbuka, pilih akun Google yang sama. Lalu:

```bash
npx firebase deploy --only firestore:rules,storage
```

**Wajib.** Firestore saat ini masih *production mode* yang **menolak semua
akses**. Tanpa langkah ini, halaman kursus akan kosong.

Isi aturannya:

- `firestore.rules` — katalog boleh dibaca siapa saja, tetapi **tidak ada yang
  bisa menulis dari browser**. Perubahan hanya lewat Console atau Admin SDK.
- `storage.rules` — berkas boleh dibaca publik, sesuai keputusan Anda
  sebelumnya. Artinya materi kursus berbayar dapat disebarluaskan bebas. Untuk
  mengubahnya, lihat bagian "Membatasi akses berkas" di bawah.

---

## Langkah 10 — Isi data & pindahkan akun

Pastikan `$env:FIREBASE_SERVICE_ACCOUNT` masih terpasang di terminal ini.

```bash
npm run migrate:firestore
```

Harus melaporkan: `4 kursus, 19 section, 52 lesson`. Kalau angkanya berbeda,
skrip sengaja **membatalkan** dan tidak menulis apa pun.

```bash
npm run import:users
```

Memindahkan 4 akun lama beserta hash kata sandinya. Aman dijalankan berulang —
akun yang sudah ada dilewati, bukan ditimpa.

> ### Kata sandi lama tetap berlaku
>
> Sudah diuji langsung terhadap proyek asli: hash bergaya Laravel `$2y$`
> dinormalkan ke `$2b$`, diimpor, lalu **login dengan kata sandi yang benar
> berhasil** dan kata sandi salah ditolak. Pengguna lama tidak perlu reset.
>
> Hal yang sama **gagal di emulator** — Auth emulator tampaknya tidak
> mengimplementasikan verifikasi bcrypt untuk akun impor. Jadi jangan menguji
> bagian ini di emulator; hasilnya menyesatkan.
>
> Kalau suatu saat memang perlu reset: **Authentication → Users**, klik ⋮ pada
> akun → **Reset password**.

### Periksa

```bash
npm run check
```

Harus melaporkan `4 kursus / 19 section / 52 lesson` dan `4 akun`.

---

## Langkah 11 — Uji lokal terhadap proyek asli

```bash
cd frontend
npm run dev
```

Buka <http://localhost:3000> dan periksa:

- [ ] Beranda menampilkan 4 kursus
- [ ] `/courses/analisis-data-eeg` menampilkan 16 pelajaran
- [ ] Daftar akun baru berhasil, nama muncul di navbar
- [ ] `/dashboard` terbuka (dan menolak saat belum masuk)
- [ ] Login akun **lama** berhasil ← ini yang harus diuji

Kalau semuanya lolos, data dan autentikasi sudah benar-benar berjalan di
Firebase asli.

---

## Langkah 12 — Deploy

```bash
npx firebase experiments:enable webframeworks
npx firebase init apphosting
```

Jawaban yang dipilih:

| Pertanyaan | Jawab |
|---|---|
| Region | `asia-southeast1` (atau terdekat) |
| Repository / source | folder `frontend` |
| Deploy branch | `dev` (atau branch Anda) |

Kalau App Hosting menyambungkan GitHub, tiap `git push` akan otomatis
men-deploy.

**Penting — variabel lingkungan tidak ikut terkirim.** Berkas `.env.local`
sengaja tidak di-commit. Buka **App Hosting → backend Anda → Environment
variables**, lalu isikan kelima `NEXT_PUBLIC_*` dari Langkah 7a.

`FIREBASE_SERVICE_ACCOUNT` **tidak perlu** di sini — App Hosting memberi
kredensial otomatis lewat Application Default Credentials.

Setelah rilis pertama, tambahkan domain aplikasi ke
**Authentication → Settings → Authorized domains**, kalau belum tercantum.

---

## Setelahnya

### Mengisi video & lampiran

**Firestore → Data → `courses` → pilih kursus → `sections` → pilih lesson.**

| Field | Tipe | Isi |
|---|---|---|
| `videoUrl` | string | Tempel tautan YouTube biasa. `https://www.youtube.com/watch?v=ABC123` sudah cukup — konversi ke URL embed dilakukan otomatis. |
| `attachments` | array | Tiap elemen: `{ name, path, size, mime }` |

Untuk lampiran: unggah berkas di **Storage** lebih dulu, lalu salin path-nya ke
field `path`.

> **Berkas WAJIB berada di bawah folder `lesson-assets/`.**
> `storage.rules` hanya mengizinkan pembacaan di dalam folder itu — berkas yang
> diunggah di tempat lain akan ditolak (403) meski path-nya benar. Contoh yang
> sah: `lesson-assets/eeg/modul-1.pdf`.
>
> Di Storage, buat foldernya lewat tombol **Create folder** bila belum ada.

> Video di YouTube **unlisted bukan berarti privat** — siapa pun yang punya
> tautannya bisa menonton dan menyebarkannya.

### Membatasi akses berkas

Saat ini `storage.rules` mengizinkan baca publik. Untuk membatasi ke pengguna
yang sudah masuk, ubah `allow read: if true;` menjadi:

```
allow read: if request.auth != null;
```

lalu jalankan `npx firebase deploy --only storage`. Catatan: berkas lalu
harus diakses lewat SDK (yang mengirim token), bukan lewat URL unduhan langsung
seperti sekarang — jadi `LearnShell` perlu penyesuaian.

### Menjaga biaya

- Kuota gratis Firestore: 50.000 baca/hari. Satu kunjungan halaman katalog =
  4 baca. Sangat lapang untuk skala demo.
- Pantau di **Usage and billing → Usage**.
- Karena section & lesson ditanam di dalam dokumen kursus, membuka satu kursus
  hanya menghabiskan **1 baca**, bukan 72.

---

## Kalau ada yang salah

| Gejala | Kemungkinan sebab |
|---|---|
| Semua halaman kosong, tidak ada kursus | Aturan keamanan belum di-deploy (Langkah 9) |
| `PERMISSION_DENIED` | Sama seperti di atas, atau service account beda proyek |
| Perubahan tidak muncul | Masih mengarah ke emulator — cek `USE_FIREBASE_EMULATOR` dan sisa `*_EMULATOR_HOST` |
| 404 di semua halaman kecuali `/` | Cache Turbopack basi — hapus `frontend/.next`, jalankan ulang |
| `auth/invalid-api-key` | `NEXT_PUBLIC_FIREBASE_API_KEY` salah salin |
| Unduhan lampiran 404 | `storageBucket` salah — salin persis dari Console |
| Login akun lama gagal | Lihat peringatan di Langkah 10; pakai reset password |

Saat ragu, jalankan `npm run check` lebih dulu — sebagian besar kesalahan
konfigurasi akan ketahuan di situ.
