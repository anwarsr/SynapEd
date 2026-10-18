/**
 * Riwayat undo/redo generik untuk papan lab.
 *
 * Modul NETRAL tanpa impor alias `@/` — dipakai komponen papan di browser dan
 * skrip verifikasi yang dijalankan tsx.
 *
 * Bentuknya "deretan snapshot + kursor", bukan tumpukan undo berisi selisih
 * (diff). Mesin lab sudah mengembalikan keadaan UTUH di setiap langkah, jadi
 * menyimpan selisih berarti menulis logika pembalik untuk 20 operasi — dua
 * puluh kesempatan baru untuk salah, demi menghemat ingatan yang tidak sedang
 * kurang (50 snapshot × 24 sel adalah data yang amat kecil).
 *
 * Konsekuensinya satu janji yang tidak boleh dilanggar pemanggilnya: keadaan
 * yang sudah masuk riwayat TIDAK PERNAH dimutasi. Seluruh `lib/lab/` sudah
 * murni demi ini; satu `items.push()` di tempat yang salah akan mengubah masa
 * lalu, dan bug "undo membawa keadaan yang keliru" nyaris mustahil dilacak
 * dari layar.
 */
import { LAB_MAX_HISTORY } from "./labTypes";

/**
 * Riwayat keadaan beserta kursornya.
 *
 * Dua invarian yang dipegang semua fungsi di berkas ini:
 * - `entries` selalu berisi minimal satu entri (dibuat oleh `initHistory`);
 * - `entries[cursor]` SELALU keadaan yang sedang tampil di papan.
 *
 * `label` adalah kalimat operasi yang MENGHASILKAN keadaan itu, dipakai
 * antarmuka untuk menulis "Batalkan: hapus di indeks 2". Entri pertama
 * memakai label pembuka seperti "papan awal" karena tidak ada operasi
 * sebelumnya.
 */
export interface LabHistory<S> {
  entries: { state: S; label: string }[];
  cursor: number;
}

export function initHistory<S>(state: S, label: string): LabHistory<S> {
  return { entries: [{ state, label }], cursor: 0 };
}

/**
 * Menambahkan keadaan baru sesudah keadaan sekarang.
 *
 * Ekor redo dipotong LEBIH DULU: setelah undo lalu mengerjakan operasi lain,
 * masa depan yang lama sudah tidak pernah terjadi. Membiarkannya akan membuat
 * tombol "ulangi" melompat ke papan yang tidak ada hubungannya dengan apa pun
 * yang baru dilakukan.
 */
export function pushHistory<S>(h: LabHistory<S>, state: S, label: string): LabHistory<S> {
  const entries = [...h.entries.slice(0, h.cursor + 1), { state, label }];

  if (entries.length > LAB_MAX_HISTORY) {
    // Membuang entri TERTUA memendekkan array dari depan, jadi setiap indeks
    // ikut turun — termasuk indeks keadaan sekarang. Kursor WAJIB turun
    // sebanyak yang dibuang; lupa menurunkannya adalah off-by-one klasik yang
    // gejalanya aneh dan menyesatkan: papan tiba-tiba menampilkan keadaan satu
    // operasi ke depan setiap kali riwayat penuh, dan tombol undo terasa
    // "meleset satu langkah" tanpa sebab yang kelihatan.
    const buang = entries.length - LAB_MAX_HISTORY;
    return { entries: entries.slice(buang), cursor: entries.length - 1 - buang };
  }

  return { entries, cursor: entries.length - 1 };
}

/**
 * Mengganti keadaan SEKARANG tanpa menambah entri — untuk perubahan yang
 * berlangsung terus (mengetik teks simbol flowchart): setiap ketukan langsung
 * terlihat, tetapi satu sesi mengetik tetap satu langkah undo. Ekor redo
 * dipotong, sama alasannya dengan `pushHistory`. Di kursor 0 (keadaan awal)
 * entri baru ditambahkan, supaya keadaan awal tetap bisa dikembalikan.
 */
export function gantiPuncakHistory<S>(h: LabHistory<S>, state: S, label: string): LabHistory<S> {
  if (h.cursor === 0) return pushHistory(h, state, label);
  return { entries: [...h.entries.slice(0, h.cursor), { state, label }], cursor: h.cursor };
}

/**
 * Mundur satu langkah.
 *
 * Di kursor 0 ia mengembalikan OBJEK YANG SAMA (`===`), bukan salinan dengan
 * isi serupa. React membandingkan state dengan identitas: salinan baru yang
 * isinya sama tetap memicu render ulang seluruh papan, jadi menahan tombol
 * "batalkan" di awal riwayat akan membuat papan berkedip tanpa ada yang
 * berubah. Alasan yang sama berlaku untuk `redoHistory` di ujung.
 */
export function undoHistory<S>(h: LabHistory<S>): LabHistory<S> {
  if (h.cursor <= 0) return h;
  // `entries` dibagi pakai, tidak disalin: isinya tidak pernah dimutasi, jadi
  // menyalinnya hanya menambah sampah tanpa menambah keamanan.
  return { entries: h.entries, cursor: h.cursor - 1 };
}

export function redoHistory<S>(h: LabHistory<S>): LabHistory<S> {
  if (h.cursor >= h.entries.length - 1) return h;
  return { entries: h.entries, cursor: h.cursor + 1 };
}

export function canUndo<S>(h: LabHistory<S>): boolean {
  return h.cursor > 0;
}

export function canRedo<S>(h: LabHistory<S>): boolean {
  return h.cursor < h.entries.length - 1;
}

export function currentState<S>(h: LabHistory<S>): S {
  return h.entries[h.cursor].state;
}
