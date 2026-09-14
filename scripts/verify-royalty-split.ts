/**
 * Pemeriksaan murni untuk pembagian uang, kontributor, dan aturan username.
 *
 * Tidak butuh dev server maupun Firestore — fungsinya murni, jadi diuji
 * langsung. Yang paling penting di sini satu: jumlah seluruh bagian SELALU
 * sama persis dengan harga jual. Rupiah yang tercipta atau hilang dari satu
 * penjualan adalah galat yang tidak pernah terlihat di layar mana pun.
 *
 *   npx tsx scripts/verify-royalty-split.ts
 */
import { check, finish } from "./testSupport";
import { splitSale } from "../frontend/src/lib/royaltySplit";
import {
  MAX_CONTRIBUTORS,
  OWNER_MIN_SHARE,
  buildContributors,
  parseStoredContributors,
  type Contributor,
} from "../frontend/src/lib/contributors";
import {
  baseUsernameFromEmail,
  normalizeUsernameInput,
  usernameCandidates,
  validateUsername,
} from "../frontend/src/lib/usernameRules";

/** PRNG deterministik supaya kegagalan bisa diulang persis. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pembagian acak yang sah: pemilik >= OWNER_MIN_SHARE, total 100. */
function randomContributors(rng: () => number): Contributor[] {
  const n = 1 + Math.floor(rng() * MAX_CONTRIBUTORS);
  const others: { uid: string; share: number }[] = [];
  let sisa = 100 - OWNER_MIN_SHARE;
  for (let i = 1; i < n && sisa > 0; i++) {
    const s = 1 + Math.floor(rng() * Math.min(sisa, 40));
    others.push({ uid: `u${i}`, share: s });
    sisa -= s;
  }
  const r = buildContributors("owner", others);
  if (!r.ok) throw new Error(r.error);
  return r.contributors;
}

// ── Pembagian uang ───────────────────────────────────────────────────────
{
  const rng = mulberry32(20260913);
  const potongan = [0, 1, 20, 33, 99, 100];
  let kasus = 0;
  let salahJumlah = 0;
  let diluarRentang = 0;

  for (let set = 0; set < 200; set++) {
    const kontributor = randomContributors(rng);
    for (const fee of potongan) {
      for (let gross = 0; gross <= 20000; gross += 1 + Math.floor(rng() * 97)) {
        const h = splitSale(gross, fee, kontributor);
        kasus++;

        const jumlah = h.feeAmount + h.unallocatedAmount + h.lines.reduce((n, l) => n + l.amount, 0);
        if (jumlah !== gross) salahJumlah++;

        const net = gross - h.feeAmount;
        for (const l of h.lines) {
          const bawah = Math.floor((net * l.share) / 100);
          if (l.amount < bawah || l.amount > bawah + 1) diluarRentang++;
        }
      }
    }
  }

  check(
    "jumlah seluruh bagian selalu tepat sama dengan harga",
    salahJumlah === 0,
    `${kasus.toLocaleString("id-ID")} kasus, ${salahJumlah} meleset`,
  );
  check(
    "setiap bagian dalam rentang [floor, floor+1] dari jatah persisnya",
    diluarRentang === 0,
    `${diluarRentang} bagian di luar rentang`,
  );
}

{
  // Kasus klasik yang menjatuhkan Math.round: 33/33/34 dari Rp100.
  const r = buildContributors("a", [
    { uid: "b", share: 33 },
    { uid: "c", share: 34 },
  ]);
  if (!r.ok) throw new Error(r.error);
  const h = splitSale(100, 0, r.contributors);
  check(
    "33/33/34 dari Rp100 tetap berjumlah Rp100",
    h.lines.reduce((n, l) => n + l.amount, 0) === 100,
    h.lines.map((l) => `${l.share}%=${l.amount}`).join(" "),
  );
}

{
  const r = buildContributors("pemilik", [{ uid: "b", share: 50 }]);
  if (!r.ok) throw new Error(r.error);
  const h = splitSale(101, 0, r.contributors);
  check(
    "sisa rupiah saat seri jatuh ke pemilik",
    h.lines[0].amount === 51 && h.lines[1].amount === 50,
    `pemilik ${h.lines[0].amount}, lain ${h.lines[1].amount}`,
  );
}

{
  const h = splitSale(100000, 20, null);
  check(
    "kursus tanpa kontributor: bagian bersih belum teralokasi",
    h.feeAmount === 20000 && h.unallocatedAmount === 80000 && h.lines.length === 0,
    `fee ${h.feeAmount}, belum teralokasi ${h.unallocatedAmount}`,
  );
}

{
  const h = splitSale(99, 33, [{ uid: "a", share: 100 }]);
  check(
    "potongan dibulatkan ke bawah, sisanya ke kontributor",
    h.feeAmount === 32 && h.lines[0].amount === 67,
    `fee ${h.feeAmount}, kontributor ${h.lines[0].amount}`,
  );
}

{
  let dilempar = 0;
  for (const salah of [
    () => splitSale(-1, 20, null),
    () => splitSale(1.5, 20, null),
    () => splitSale(100, 101, null),
    () => splitSale(100, 20, [{ uid: "a", share: 60 }]),
    () =>
      splitSale(100, 20, [
        { uid: "a", share: 50 },
        { uid: "a", share: 50 },
      ]),
  ]) {
    try {
      salah();
    } catch {
      dilempar++;
    }
  }
  check("masukan tidak sah ditolak, bukan dihitung diam-diam", dilempar === 5, `${dilempar}/5 dilempar`);
}

// ── Kontributor ──────────────────────────────────────────────────────────
{
  const ok = buildContributors("pemilik", [
    { uid: "b", share: 30 },
    { uid: "c", share: 15 },
  ]);
  check(
    "jatah pemilik dihitung sebagai sisa",
    ok.ok && ok.contributors[0].uid === "pemilik" && ok.contributors[0].share === 55,
    ok.ok ? `pemilik ${ok.contributors[0].share}%` : ok.error,
  );

  const penolakan: [string, ReturnType<typeof buildContributors>][] = [
    ["uid ganda", buildContributors("p", [{ uid: "b", share: 10 }, { uid: "b", share: 10 }])],
    ["pemilik dicantumkan lagi", buildContributors("p", [{ uid: "p", share: 10 }])],
    ["persentase pecahan", buildContributors("p", [{ uid: "b", share: 10.5 }])],
    ["persentase nol", buildContributors("p", [{ uid: "b", share: 0 }])],
    ["pemilik di bawah minimum", buildContributors("p", [{ uid: "b", share: 95 }])],
    [
      "melebihi jumlah maksimal",
      buildContributors(
        "p",
        Array.from({ length: MAX_CONTRIBUTORS }, (_, i) => ({ uid: `u${i}`, share: 1 })),
      ),
    ],
    ["share bukan angka", buildContributors("p", [{ uid: "b", share: "30" }])],
  ];

  for (const [nama, hasil] of penolakan) {
    check(`kontributor ditolak: ${nama}`, !hasil.ok, hasil.ok ? "LOLOS" : hasil.error);
  }

  // Data tersimpan yang jatah pemiliknya dikarang (tidak sama dengan sisa).
  check(
    "data tersimpan dengan jatah pemilik yang tidak cocok dianggap rusak",
    parseStoredContributors(
      [
        { uid: "p", share: 100 },
        { uid: "b", share: 50 },
      ],
      "p",
    ) === null,
    "tidak dipercaya",
  );
  check(
    "data tersimpan yang sah diterima",
    parseStoredContributors(
      [
        { uid: "p", share: 70 },
        { uid: "b", share: 30 },
      ],
      "p",
    ) !== null,
    "diterima",
  );
}

// ── Username ─────────────────────────────────────────────────────────────
{
  check(
    "username dibentuk dari bagian lokal email",
    baseUsernameFromEmail("Budi.Santoso+kursus@gmail.com") === "budi.santoso",
    String(baseUsernameFromEmail("Budi.Santoso+kursus@gmail.com")),
  );
  check(
    "tanda hubung menjadi garis bawah",
    baseUsernameFromEmail("ani-rahma@x.id") === "ani_rahma",
    String(baseUsernameFromEmail("ani-rahma@x.id")),
  );
  check(
    "email tanpa huruf tidak menghasilkan dasar",
    baseUsernameFromEmail("12345@x.id") === null,
    "jatuh ke cadangan",
  );

  for (const salah of ["ab", ".abc", "abc.", "a..b", "ABC!", "12345", "admin", "a".repeat(31)]) {
    const u = salah === "ABC!" ? salah : salah;
    check(`username tidak sah ditolak: "${salah}"`, validateUsername(u) !== null, String(validateUsername(u)));
  }

  check(
    "masukan dinormalkan: @Budi_1 -> budi_1",
    normalizeUsernameInput("  @Budi_1 ") === "budi_1",
    normalizeUsernameInput("  @Budi_1 "),
  );

  const a = usernameCandidates("budi@x.id", "uid-satu", () => 0.5);
  const b = usernameCandidates("budi@x.id", "uid-satu", () => 0.5);
  check(
    "calon username deterministik untuk akun yang sama",
    JSON.stringify(a.slice(0, 6)) === JSON.stringify(b.slice(0, 6)),
    a.slice(0, 3).join(", "),
  );
  check(
    "seluruh calon username sah",
    a.every((u) => validateUsername(u) === null),
    `${a.length} calon`,
  );
  check(
    "akun tanpa email tidak mendapat nama terlarang 'pengguna'",
    !usernameCandidates(null, "x").includes("pengguna") &&
      usernameCandidates(null, "x").every((u) => validateUsername(u) === null),
    usernameCandidates(null, "x")[0],
  );
}

finish();
