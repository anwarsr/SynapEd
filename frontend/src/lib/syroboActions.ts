"use server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { beli, beliPakaian, beriMakan, detak, gantiNama, gosok, klaim, pasangPakaian, ukuranPakaian, bacaSyrobo, type HasilSyrobo } from "@/lib/syrobo/syroboCore";
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

export async function muatSyrobo(): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  if (!uid) return BELUM_MASUK;
  return { ok: true, robot: await bacaSyrobo(adminDb(), uid) };
}

export async function detakSyrobo(): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? detak(adminDb(), uid) : BELUM_MASUK;
}

export async function klaimSyrobo(menit: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? klaim(adminDb(), uid, menit) : BELUM_MASUK;
}

export async function beliMakananSyrobo(id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? beli(adminDb(), uid, id) : BELUM_MASUK;
}

export async function beriMakanSyrobo(id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? beriMakan(adminDb(), uid, id) : BELUM_MASUK;
}

export async function gosokSyrobo(tambah: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? gosok(adminDb(), uid, tambah) : BELUM_MASUK;
}

export async function beliPakaianSyrobo(id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? beliPakaian(adminDb(), uid, id) : BELUM_MASUK;
}

export async function pasangPakaianSyrobo(slot: unknown, id: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? pasangPakaian(adminDb(), uid, slot, id) : BELUM_MASUK;
}

export async function ukuranPakaianSyrobo(slot: unknown, persen: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? ukuranPakaian(adminDb(), uid, slot, persen) : BELUM_MASUK;
}

export async function gantiNamaSyrobo(nama: unknown): Promise<HasilSyrobo> {
  const uid = await uidSesi();
  return uid ? gantiNama(adminDb(), uid, nama) : BELUM_MASUK;
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
