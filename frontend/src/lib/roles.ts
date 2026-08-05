/**
 * Role dan turunannya. Modul ini sengaja netral — tanpa `server-only` —
 * karena navbar dan form di browser juga perlu mengenali role.
 *
 * Nilai sebenarnya hidup sebagai custom claim di Firebase Auth, bukan di
 * Firestore, supaya ikut di dalam ID token dan session cookie dan tidak bisa
 * ditulis dari klien.
 */
export type Role = "admin" | "educator" | "user";

/** Claim mentah -> Role. Apa pun yang tidak dikenali jatuh ke "user". */
export function toRole(claim: unknown): Role {
  return claim === "admin" ? "admin" : claim === "educator" ? "educator" : "user";
}

export const roleLabel: Record<Role, string> = {
  admin: "Admin",
  educator: "Educator",
  user: "User",
};

/** Urutan tampil di daftar admin: yang paling berwenang di atas. */
export const roleRank: Record<Role, number> = {
  admin: 0,
  educator: 1,
  user: 2,
};
