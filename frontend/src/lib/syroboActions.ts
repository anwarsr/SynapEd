"use server";
import { adminDb } from "@/lib/firebase/admin";
import { getPremium } from "@/lib/premium";
import { getCurrentUser } from "@/lib/firebase/session";
import { beli, beliPakaian, beriMakan, beriMakanDewa, simpanKoinGame, tukarKoinGame, detak, gantiNama, gosok, klaim, pasangPakaian, ukuranPakaian, bacaSyrobo, type HasilSyrobo } from "@/lib/syrobo/syroboCore";
import type { Suasana } from "@/lib/syrobo/syroboRules";

/**
 * Server Action SyRobo. Setiap ekspor adalah endpoint publik, jadi tiap fungsi memeriksa sesi sendiri dan uid
 * SELALU dari sesi. Poin hanya berubah lewat `syroboCore` (transaksi); tidak ada angka poin dari browser.
 */

const BELUM_MASUK: HasilSyrobo = { ok: false, error: "Silakan masuk terlebih dahulu." };

async function uidSesi(): Promise<string | null> {
  const user = await getCurrentUser();
  return user ? user.uid : null;
}

/** Premium aktif SAAT INI menurut keanggotaan di server (bukan kiriman browser). Gagal membaca = dianggap tidak aktif. */
async function premiumDari(uid: string): Promise<boolean> {
  try {
    return (await getPremium(uid)).aktif;
  } catch {
    return false;
  }
}

export async function muatSyrobo(): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  if (!uid) return BELUM_MASUK;
  return { ok: true, robot: await bacaSyrobo(adminDb(), uid, new Date(), await premiumDari(uid)) };
}

export async function detakSyrobo(): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? detak(adminDb(), uid, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function klaimSyrobo(menit: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? klaim(adminDb(), uid, menit, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function beliMakananSyrobo(id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? beli(adminDb(), uid, id, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function beriMakanSyrobo(id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? beriMakan(adminDb(), uid, id, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function beriMakanDewaSyrobo(id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? beriMakanDewa(adminDb(), uid, id, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function simpanKoinGameSyrobo(n: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? simpanKoinGame(adminDb(), uid, n, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function tukarKoinGameSyrobo(): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? tukarKoinGame(adminDb(), uid, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function gosokSyrobo(tambah: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? gosok(adminDb(), uid, tambah, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function beliPakaianSyrobo(id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? beliPakaian(adminDb(), uid, id, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function pasangPakaianSyrobo(slot: unknown, id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? pasangPakaian(adminDb(), uid, slot, id, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function ukuranPakaianSyrobo(slot: unknown, persen: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? ukuranPakaian(adminDb(), uid, slot, persen, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

export async function gantiNamaSyrobo(nama: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? gantiNama(adminDb(), uid, nama, new Date(), await premiumDari(uid)) : BELUM_MASUK;
}

/**
 * Suasana robot PENGGUNA SESI untuk ekspresi robot asisten di semua halaman. Hanya membaca (tanpa menulis) dan
 * hanya mengembalikan suasana + nama, tidak ada poin/stok. null = belum masuk.
 */
export async function suasanaSyroboSaya(): Promise<{ suasana: Suasana; nama: string } | null> {
  const uid = await uidSesi();
  if (!uid) return null;
  const r = await bacaSyrobo(adminDb(), uid);
  return { suasana: r.suasana, nama: r.nama };
}
