/**
 * Pengenal metode masuk Firebase.
 *
 * Modul ini sengaja netral — tanpa "use client" maupun "server-only" — karena
 * dipakai di kedua sisi. Menaruhnya di berkas ber-"use client" pernah membuat
 * kode server menerima referensi klien alih-alih string, sehingga setiap
 * perbandingan diam-diam bernilai false tanpa satu pun galat tipe.
 */
export const PASSWORD_PROVIDER = "password";
export const GOOGLE_PROVIDER = "google.com";
