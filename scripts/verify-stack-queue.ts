/**
 * Menguji Lab Stack & Lab Queue (lib/lab/stackLab.ts, queueLab.ts, kodenya,
 * katalog, dan codec URL). Murni - tanpa dev server & kredensial.
 *
 * Pemeriksaan terpenting: pseudocode 9618 yang TAMPIL di panel dijalankan di
 * mesin pseudocode Lab 05 untuk ribuan urutan operasi acak, lalu keluarannya
 * (OUTPUT, nilai kembalian, penunjuk, dan SELURUH isi memori termasuk sisa)
 * harus sama persis dengan hasil reducer. Kode di layar dan animasinya tidak
 * bisa diam-diam berbeda.
 *
 *   npx tsx scripts/verify-stack-queue.ts
 */
import { check, finish } from "./checks";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";
import { jalankanPseudo } from "../frontend/src/lib/lab/pseudo/pseudoJalan";
import { ADT_MAX_LANGKAH } from "../frontend/src/lib/lab/adtBersama";
import { decodeLabSnapshot, encodeLabSnapshot } from "../frontend/src/lib/lab/labUrl";
import {
  applyStackOp,
  assertStackInvariants,
  emptyStackState,
  isiStack,
  type StackLabState,
  type StackOp,
} from "../frontend/src/lib/lab/stackLab";
import {
  applyQueueOp,
  assertQueueInvariants,
  emptyQueueState,
  isiQueue,
  queuePenuh,
  type JenisQueue,
  type QueueLabState,
  type QueueOp,
} from "../frontend/src/lib/lab/queueLab";
import { KODE_BALIK, KODE_KURUNG, KODE_UNDO, kodeStack, kodeStackDariId } from "../frontend/src/lib/lab/stackKode";
import { KODE_LOKET, kodeQueue, kodeQueueDariId } from "../frontend/src/lib/lab/queueKode";
import { QUEUE_OP_CATALOG, STACK_OP_CATALOG, buildQueueOp, buildStackOp } from "../frontend/src/lib/lab/stackQueueCatalog";
import type { LabStep } from "../frontend/src/lib/lab/labTypes";

const P = "←";

function akhir<S>(r: { ok: true; steps: LabStep<S>[] } | { ok: false; error: string }): S | null {
  return r.ok ? r.steps[r.steps.length - 1].state : null;
}

/** Setiap langkah: narasi ada, baris kode menunjuk teks yang ada, jumlah langkah dibatasi. */
function periksaLangkah<S>(steps: LabStep<S>[], sumber: (id: string) => string | null): string | null {
  if (steps.length === 0) return "tanpa langkah";
  if (steps.length > ADT_MAX_LANGKAH) return `${steps.length} langkah`;
  for (const l of steps) {
    if (!l.narasi.trim()) return "narasi kosong";
    if (l.narasi.includes("—")) return "narasi memakai em dash";
    if (l.kode) {
      const teks = sumber(l.kode.id);
      if (teks === null) return `kode ${l.kode.id} tidak dikenal`;
      const n = teks.replace(/\n$/, "").split("\n").length;
      if (!(l.kode.dari >= 1 && l.kode.sampai >= l.kode.dari && l.kode.sampai <= n)) return `baris ${l.kode.dari}-${l.kode.sampai} di luar ${n} baris (${l.kode.id})`;
    }
  }
  return null;
}

// ── Stack: reducer = pseudocode ─────────────────────────────────────────
{
  let beda: string | null = null;
  let galat: string | null = null;
  let langkahSalah: string | null = null;
  let invarian: string | null = null;
  let percobaan = 0;
  for (let semai = 1; semai <= 160; semai++) {
    const acak = mulberry32(semai);
    const kap = 2 + Math.floor(acak() * 9);
    let s: StackLabState = emptyStackState(kap);
    const driver: string[] = [];
    const harap: string[] = [];
    const ops = 6 + Math.floor(acak() * 22);
    for (let i = 0; i < ops; i++) {
      const r = acak();
      let op: StackOp;
      if (r < 0.45) op = { kind: "push", nilai: String(Math.floor(acak() * 100)) };
      else if (r < 0.75) op = { kind: "pop" };
      else if (r < 0.85) op = { kind: "peek" };
      else if (r < 0.9) op = { kind: "isEmpty" };
      else if (r < 0.95) op = { kind: "isFull" };
      else op = { kind: "kosongkan" };
      const hasil = applyStackOp(s, op);
      if (!hasil.ok) {
        galat ||= `semai ${semai}: ${hasil.error}`;
        break;
      }
      langkahSalah ||= periksaLangkah(hasil.steps, kodeStackDariId);
      s = akhir(hasil)!;
      invarian ||= assertStackInvariants(s);
      harap.push(...s.keluaran);
      switch (op.kind) {
        case "push":
          driver.push(`CALL Push("${op.nilai}")`);
          break;
        case "pop":
        case "peek":
          driver.push(`OUTPUT "R:", ${op.kind === "pop" ? "Pop" : "Peek"}()`);
          harap.push(`R:${s.item ?? ""}`);
          break;
        case "isEmpty":
        case "isFull":
          driver.push(`OUTPUT "R:", ${op.kind === "isEmpty" ? "IsEmpty" : "IsFull"}()`);
          harap.push(`R:${s.item}`);
          break;
        case "kosongkan":
          driver.push(`TopPointer ${P} -1`);
          break;
        default:
          break;
      }
    }
    driver.push(`OUTPUT "T:", TopPointer`);
    // Isi memori, termasuk SISA di atas TopPointer. Sel yang menurut reducer belum pernah
    // ditulis tidak dibaca: mesin 9618 menolak membaca elemen array tanpa nilai.
    s.memori.forEach((c, i) => c && driver.push(`OUTPUT "M${i}:", Stack[${i}]`));
    harap.push(`T:${s.top}`, ...s.memori.flatMap((c, i) => (c ? [`M${i}:${c.nilai}`] : [])));
    const j = jalankanPseudo(kodeStack(kap) + "\n" + driver.join("\n") + "\n", "", { rekam: false });
    percobaan++;
    if (j.galat) {
      galat ||= `semai ${semai}: pseudocode ${j.galat.pesan} (baris ${j.galat.baris})`;
      continue;
    }
    const dapat = j.keluaran.replace(/\n$/, "").split("\n");
    if (!beda && dapat.join("|") !== harap.join("|")) beda = `semai ${semai} kap ${kap}: pseudocode [${dapat.join("|")}] vs reducer [${harap.join("|")}]`;
  }
  check("stack: pseudocode 9618 di panel berjalan tanpa galat", galat === null, galat ?? `${percobaan} urutan acak`);
  check("stack: OUTPUT, nilai kembalian, TopPointer, dan isi memori = reducer", beda === null, beda ?? "160 urutan, kapasitas 2-10");
  check("stack: setiap langkah bernarasi & menunjuk baris kode yang ada", langkahSalah === null, langkahSalah ?? "ok");
  check("stack: keadaan akhir setiap operasi rapi", invarian === null, invarian ?? "ok");
}

// ── Stack: perilaku yang diajarkan ──────────────────────────────────────
{
  const isi = akhir(applyStackOp(emptyStackState(4), { kind: "isiDariTeks", teks: "1 2 3 4" }))!;
  const penuh = applyStackOp(isi, { kind: "push", nilai: "9" });
  const sesudah = akhir(penuh)!;
  check("overflow dijalankan sebagai langkah (bukan galat) dan tidak mengubah isi", penuh.ok && sesudah.keluaran[0] === "Stack penuh (overflow)" && isiStack(sesudah).map((c) => c.nilai).join() === "1,2,3,4", sesudah.keluaran.join());
  const pop = applyStackOp(isi, { kind: "pop" });
  const ps = akhir(pop)!;
  check("pop: TopPointer turun, nilainya TETAP tertinggal di memori", ps.top === 2 && ps.memori[3]?.nilai === "4" && ps.item === "4", JSON.stringify({ t: ps.top, m: ps.memori[3]?.nilai }));
  if (pop.ok) {
    const urut = pop.steps.map((l) => l.kode?.dari).join(",");
    const k = kodeStack(4).split("\n");
    const isiBaris = pop.steps.map((l) => (l.kode ? k[l.kode.dari - 1].trim() : ""));
    check("pop: baca Stack[TopPointer] DULU, baru TopPointer turun", isiBaris.indexOf(`Item ${P} Stack[TopPointer]`) < isiBaris.indexOf(`TopPointer ${P} TopPointer - 1`) && isiBaris.indexOf(`Item ${P} Stack[TopPointer]`) >= 0, urut);
  }
  const push = applyStackOp(ps, { kind: "push", nilai: "8" });
  if (push.ok) {
    const k = kodeStack(4).split("\n");
    const isiBaris = push.steps.map((l) => (l.kode ? k[l.kode.dari - 1].trim() : ""));
    check("push: TopPointer naik DULU, baru ditulis", isiBaris.indexOf(`TopPointer ${P} TopPointer + 1`) >= 0 && isiBaris.indexOf(`TopPointer ${P} TopPointer + 1`) < isiBaris.indexOf(`Stack[TopPointer] ${P} Item`), isiBaris.join(" / "));
    const tengah = push.steps[1];
    check("push: sisa nilai lama yang akan ditimpa ditandai di langkah tengah", tengah.peran?.[ps.memori[3]!.id] === "luar", JSON.stringify(tengah.peran));
    check("push: sisa ditimpa nilai baru", akhir(push)!.memori[3]?.nilai === "8", String(akhir(push)!.memori[3]?.nilai));
  }
  const kosong = applyStackOp(emptyStackState(3), { kind: "pop" });
  check("underflow: OUTPUT 'Stack kosong' dan kembalian kosong", akhir(kosong)!.keluaran[0] === "Stack kosong (underflow)" && akhir(kosong)!.item === "", JSON.stringify(akhir(kosong)!.keluaran));
  const s0 = emptyStackState(3);
  const tolak = [
    applyStackOp(s0, { kind: "push", nilai: "terlalupanjang" }),
    applyStackOp(s0, { kind: "push", nilai: "a,b" }),
    applyStackOp(s0, { kind: "isiDariTeks", teks: "1 2 3 4" }),
    applyStackOp(s0, { kind: "kapasitas", kapasitas: 11 }),
    applyStackOp(isi, { kind: "kapasitas", kapasitas: 3 }),
    applyStackOp(s0, { kind: "balikKata", kata: "PANJANG" }),
    applyStackOp(s0, { kind: "undo", kejadian: "a,b" }),
  ];
  check("masukan salah ditolak (bukan dipotong diam-diam)", tolak.every((r) => !r.ok), tolak.map((r) => (r.ok ? "LOLOS" : "tolak")).join(","));
  const besar = akhir(applyStackOp(isi, { kind: "kapasitas", kapasitas: 6 }))!;
  check("ubah kapasitas mempertahankan isi & TopPointer", besar.kapasitas === 6 && besar.top === 3 && isiStack(besar).map((c) => c.nilai).join() === "1,2,3,4" && assertStackInvariants(besar) === null, String(besar.top));
}

// ── Stack: penerapan = pseudocode ───────────────────────────────────────
{
  const KASUS: [string, boolean][] = [
    ["{[()]}", true], ["(a+b)*(c-d)", true], ["(]", false], ["((", false], ["a)", false], ["([)]", false], ["{[(a+b)*c]}", true], ["x", true], ["(()", false], ["())", false],
  ];
  let beda: string | null = null;
  let salahHarap: string | null = null;
  let langkahSalah: string | null = null;
  for (const [teks, seimbang] of KASUS) {
    const r = applyStackOp(emptyStackState(6), { kind: "cekKurung", teks });
    if (!r.ok) {
      beda ||= `${teks}: ${r.error}`;
      continue;
    }
    langkahSalah ||= periksaLangkah(r.steps, kodeStackDariId);
    const hasil = akhir(r)!.pita?.simpulan?.baik;
    if (hasil !== seimbang) salahHarap ||= `${teks}: reducer ${hasil}`;
    const j = jalankanPseudo(kodeStack(6) + KODE_KURUNG + `\nOUTPUT Seimbang("${teks}")\n`, "", { rekam: false });
    if (j.galat || j.keluaran.trim() !== (seimbang ? "TRUE" : "FALSE")) beda ||= `${teks}: pseudocode ${j.galat?.pesan ?? j.keluaran.trim()}`;
  }
  check("cek kurung: hasil reducer benar untuk 10 kasus", salahHarap === null, salahHarap ?? "ok");
  check("cek kurung: pseudocode Seimbang memberi hasil yang sama", beda === null, beda ?? "ok");
  check("cek kurung: langkah sah", langkahSalah === null, langkahSalah ?? "ok");
  const dalam = akhir(applyStackOp(emptyStackState(2), { kind: "cekKurung", teks: "(((" }))!;
  check("cek kurung: terlalu bersarang = overflow dilaporkan, bukan 'seimbang'", dalam.pita?.simpulan?.baik === false && dalam.keluaran.includes("Stack penuh (overflow)"), JSON.stringify(dalam.pita?.simpulan));

  let balikBeda: string | null = null;
  for (const kata of ["KASUR", "ab", "SynapEd", "1234567890"]) {
    const r = applyStackOp(emptyStackState(10), { kind: "balikKata", kata });
    const dapat = akhir(r)?.pita?.simpulan?.teks;
    const j = jalankanPseudo(kodeStack(10) + KODE_BALIK + `\nOUTPUT BalikKata("${kata}")\n`, "", { rekam: false });
    const harap = [...kata].reverse().join("");
    if (dapat !== harap || j.keluaran.trim() !== harap) balikBeda ||= `${kata}: reducer ${dapat}, pseudocode ${j.galat?.pesan ?? j.keluaran.trim()}`;
  }
  check("balik kata: reducer & pseudocode membalik urutan (LIFO)", balikBeda === null, balikBeda ?? "4 kata");

  let undoBeda: string | null = null;
  for (const [kap, kejadian] of [[6, "Saya suka kopi < teh"], [3, "a b c d < < < < <"], [4, "< x < y z"]] as const) {
    const r = applyStackOp(emptyStackState(kap), { kind: "undo", kejadian });
    const st = akhir(r)!;
    const drv = kejadian.split(" ").map((t) => (t === "<" ? "CALL Batalkan()" : `CALL Ketik("${t}")`)).join("\n");
    const j = jalankanPseudo(kodeStack(kap) + KODE_UNDO + `\n${drv}\nOUTPUT "T:", TopPointer\n`, "", { rekam: false });
    const harap = [...st.keluaran, `T:${st.top}`].join("|");
    const dapat = j.keluaran.replace(/\n$/, "").split("\n").join("|");
    if (j.galat || harap !== dapat) undoBeda ||= `"${kejadian}": reducer [${harap}] vs pseudocode [${j.galat?.pesan ?? dapat}]`;
  }
  check("undo: OUTPUT & TopPointer reducer = pseudocode (termasuk penuh & kosong)", undoBeda === null, undoBeda ?? "3 skenario");
  const dok = akhir(applyStackOp(emptyStackState(6), { kind: "undo", kejadian: "Saya suka kopi < teh" }))!.pita?.simpulan?.teks;
  check("undo: dokumen akhir = 'Saya suka teh'", dok === "Saya suka teh", String(dok));
}

// ── Queue: reducer = pseudocode, linear & melingkar ─────────────────────
for (const jenis of ["linear", "melingkar"] as JenisQueue[]) {
  let beda: string | null = null;
  let galat: string | null = null;
  let langkahSalah: string | null = null;
  let invarian: string | null = null;
  let putar = 0;
  for (let semai = 1; semai <= 160; semai++) {
    const acak = mulberry32(semai * 7 + (jenis === "linear" ? 1 : 2));
    const kap = 2 + Math.floor(acak() * 9);
    let s: QueueLabState = emptyQueueState(jenis, kap);
    const driver: string[] = [];
    const harap: string[] = [];
    const ops = 8 + Math.floor(acak() * 30);
    for (let i = 0; i < ops; i++) {
      const r = acak();
      let op: QueueOp;
      if (r < 0.5) op = { kind: "enqueue", nilai: String(Math.floor(acak() * 100)) };
      else if (r < 0.82) op = { kind: "dequeue" };
      else if (r < 0.88) op = { kind: "peek" };
      else if (r < 0.92) op = { kind: "isEmpty" };
      else if (r < 0.97) op = { kind: "isFull" };
      else op = { kind: "kosongkan" };
      const sebelum = s;
      const hasil = applyQueueOp(s, op);
      if (!hasil.ok) {
        galat ||= `semai ${semai}: ${hasil.error}`;
        break;
      }
      langkahSalah ||= periksaLangkah(hasil.steps, kodeQueueDariId);
      s = akhir(hasil)!;
      if (jenis === "melingkar" && op.kind === "enqueue" && sebelum.rear === kap - 1 && s.rear === 0) putar++;
      invarian ||= assertQueueInvariants(s);
      harap.push(...s.keluaran);
      switch (op.kind) {
        case "enqueue":
          driver.push(`CALL Enqueue("${op.nilai}")`);
          break;
        case "dequeue":
        case "peek":
          driver.push(`OUTPUT "R:", ${op.kind === "dequeue" ? "Dequeue" : "Peek"}()`);
          harap.push(`R:${s.item ?? ""}`);
          break;
        case "isEmpty":
        case "isFull":
          driver.push(`OUTPUT "R:", ${op.kind === "isEmpty" ? "IsEmpty" : "IsFull"}()`);
          harap.push(`R:${s.item}`);
          break;
        case "kosongkan":
          driver.push(`FrontPointer ${P} 0`, `RearPointer ${P} -1`, `NumberInQueue ${P} 0`);
          break;
        default:
          break;
      }
    }
    driver.push(`OUTPUT "P:", FrontPointer, ":", RearPointer, ":", NumberInQueue`);
    s.memori.forEach((c, i) => c && driver.push(`OUTPUT "M${i}:", Queue[${i}]`));
    harap.push(`P:${s.front}:${s.rear}:${s.jumlah}`, ...s.memori.flatMap((c, i) => (c ? [`M${i}:${c.nilai}`] : [])));
    const j = jalankanPseudo(kodeQueue(jenis, kap) + "\n" + driver.join("\n") + "\n", "", { rekam: false });
    if (j.galat) {
      galat ||= `semai ${semai}: pseudocode ${j.galat.pesan} (baris ${j.galat.baris})`;
      continue;
    }
    const dapat = j.keluaran.replace(/\n$/, "").split("\n");
    if (!beda && dapat.join("|") !== harap.join("|")) beda = `semai ${semai} kap ${kap}: pseudocode [${dapat.join("|")}] vs reducer [${harap.join("|")}]`;
  }
  check(`queue ${jenis}: pseudocode berjalan tanpa galat`, galat === null, galat ?? "160 urutan acak");
  check(`queue ${jenis}: OUTPUT, kembalian, Front/Rear/Number, dan isi memori = reducer`, beda === null, beda ?? "kapasitas 2-10");
  check(`queue ${jenis}: setiap langkah bernarasi & menunjuk baris kode yang ada`, langkahSalah === null, langkahSalah ?? "ok");
  check(`queue ${jenis}: keadaan akhir rapi`, invarian === null, invarian ?? "ok");
  if (jenis === "melingkar") check("queue melingkar: uji acak benar-benar melewati RearPointer kembali ke 0", putar > 20, `${putar} kali`);
}

// ── Queue: perilaku yang diajarkan ──────────────────────────────────────
{
  const demo = (jenis: JenisQueue) => akhir(applyQueueOp(emptyQueueState(jenis, 5), { kind: "penuhSemu" }))!;
  const lin = demo("linear");
  const mel = demo("melingkar");
  check("penuh semu: queue LINEAR menolak X walau 2 slot depan kosong", lin.keluaran.includes("Queue penuh") && !isiQueue(lin).some((c) => c.nilai === "X") && lin.front === 2 && queuePenuh(lin), JSON.stringify({ k: lin.keluaran, f: lin.front }));
  check("penuh semu: queue MELINGKAR menaruh X di indeks 0", !mel.keluaran.includes("Queue penuh") && mel.memori[0]?.nilai === "X" && mel.rear === 0 && mel.jumlah === 4, JSON.stringify({ r: mel.rear, m0: mel.memori[0]?.nilai }));
  const r = applyQueueOp(akhir(applyQueueOp(emptyQueueState("melingkar", 3), { kind: "isiDariTeks", teks: "a b c" }))!, { kind: "dequeue" });
  check("dequeue: Item dibaca dari depan, sisa tertinggal di memori", akhir(r)!.item === "a" && akhir(r)!.memori[0]?.nilai === "a" && akhir(r)!.front === 1, String(akhir(r)!.item));
  const isi = akhir(applyQueueOp(emptyQueueState("linear", 4), { kind: "isiDariTeks", teks: "1 2 3" }))!;
  const keluar = akhir(applyQueueOp(isi, { kind: "dequeue" }))!;
  const ubah = akhir(applyQueueOp(keluar, { kind: "jenis", jenis: "melingkar" }))!;
  check("ganti jenis: isi antrean disalin mulai indeks 0, urutan tetap", ubah.jenis === "melingkar" && ubah.front === 0 && isiQueue(ubah).map((c) => c.nilai).join() === "2,3" && assertQueueInvariants(ubah) === null, isiQueue(ubah).map((c) => c.nilai).join());
  const ids = isiQueue(keluar).map((c) => c.id).join();
  check("ganti jenis: sel mempertahankan id (meluncur, bukan muncul ulang)", isiQueue(ubah).map((c) => c.id).join() === ids, ids);
  const q0 = emptyQueueState("melingkar", 3);
  const tolak = [
    applyQueueOp(q0, { kind: "enqueue", nilai: "" }),
    applyQueueOp(q0, { kind: "isiDariTeks", teks: "1 2 3 4" }),
    applyQueueOp(isi, { kind: "kapasitas", kapasitas: 2 }),
    applyQueueOp(q0, { kind: "jenis", jenis: "melingkar" }),
    applyQueueOp(q0, { kind: "loket", kejadian: "Ani" }),
  ];
  check("queue: masukan salah ditolak", tolak.every((x) => !x.ok), tolak.map((x) => (x.ok ? "LOLOS" : "tolak")).join(","));

  let loketBeda: string | null = null;
  for (const [jenis, kap, kejadian] of [["melingkar", 3, "+Ani +Budi - +Cici - -"], ["linear", 3, "+A +B +C +D - - +E -"], ["melingkar", 2, "- +A +B +C - +D - - -"]] as const) {
    const st = akhir(applyQueueOp(emptyQueueState(jenis, kap), { kind: "loket", kejadian }))!;
    const drv = kejadian.split(" ").map((t) => (t === "-" ? "CALL Layani()" : `CALL Datang("${t.slice(1)}")`)).join("\n");
    const j = jalankanPseudo(kodeQueue(jenis, kap) + KODE_LOKET + `\n${drv}\n`, "", { rekam: false });
    const dapat = j.keluaran.replace(/\n$/, "").split("\n").join("|");
    if (j.galat || dapat !== st.keluaran.join("|")) loketBeda ||= `${jenis} "${kejadian}": reducer [${st.keluaran.join("|")}] vs pseudocode [${j.galat?.pesan ?? dapat}]`;
  }
  check("loket: OUTPUT reducer = pseudocode Datang/Layani (penuh, kosong, melingkar)", loketBeda === null, loketBeda ?? "3 skenario");
  const urut = akhir(applyQueueOp(emptyQueueState("melingkar", 4), { kind: "loket", kejadian: "+Ani +Budi +Cici - - -" }))!.pita?.hasil;
  check("loket: dilayani sesuai urutan datang (FIFO)", urut === "Ani, Budi, Cici", String(urut));
}

// ── Katalog & formulir ──────────────────────────────────────────────────
{
  let gagalContoh: string | null = null;
  for (const spec of Object.values(STACK_OP_CATALOG)) {
    const r = applyStackOp(akhir(applyStackOp(emptyStackState(6), { kind: "isiDariTeks", teks: "1 2" }))!, spec.contoh);
    if (!r.ok) gagalContoh ||= `stack ${spec.kind}: ${r.error}`;
  }
  for (const spec of Object.values(QUEUE_OP_CATALOG)) {
    const r = applyQueueOp(akhir(applyQueueOp(emptyQueueState("melingkar", 6), { kind: "isiDariTeks", teks: "1 2" }))!, spec.contoh);
    if (!r.ok) gagalContoh ||= `queue ${spec.kind}: ${r.error}`;
  }
  check("contoh setiap operasi di katalog sah", gagalContoh === null, gagalContoh ?? `${Object.keys(STACK_OP_CATALOG).length + Object.keys(QUEUE_OP_CATALOG).length} operasi`);
  check("formulir: kolom kosong tidak menjadi operasi", buildStackOp("push", { nilai: "  " }) === null && buildQueueOp("kapasitas", { kapasitas: "" }) === null, "null");
  check("formulir: pilihan jenis bawaan = melingkar", JSON.stringify(buildQueueOp("jenis", {})) === '{"kind":"jenis","jenis":"melingkar"}', JSON.stringify(buildQueueOp("jenis", {})));
}

// ── Tautan bagikan ──────────────────────────────────────────────────────
{
  let gagalPulang: string | null = null;
  for (let semai = 1; semai <= 60; semai++) {
    const acak = mulberry32(900 + semai);
    let st: StackLabState = emptyStackState(2 + Math.floor(acak() * 9));
    let qu: QueueLabState = emptyQueueState(acak() < 0.5 ? "linear" : "melingkar", 2 + Math.floor(acak() * 9));
    for (let i = 0; i < 20; i++) {
      st = akhir(applyStackOp(st, acak() < 0.6 ? { kind: "push", nilai: acak() < 0.2 ? "(" : String(Math.floor(acak() * 999)) } : { kind: "pop" }))!;
      qu = akhir(applyQueueOp(qu, acak() < 0.6 ? { kind: "enqueue", nilai: String(Math.floor(acak() * 999)) } : { kind: "dequeue" }))!;
    }
    for (const snap of [{ lab: "stack" as const, state: st }, { lab: "queue" as const, state: qu }]) {
      const kode = encodeLabSnapshot(snap);
      const balik = kode ? decodeLabSnapshot(kode) : null;
      const sama =
        balik !== null &&
        balik.lab === snap.lab &&
        JSON.stringify((balik.state as { memori: { nilai: string }[] }).memori.map((c) => c?.nilai ?? null)) === JSON.stringify(snap.state.memori.map((c) => c?.nilai ?? null)) &&
        (snap.lab === "stack"
          ? (balik.state as StackLabState).top === st.top
          : ["front", "rear", "jumlah", "jenis"].every((k) => (balik.state as unknown as Record<string, unknown>)[k] === (qu as unknown as Record<string, unknown>)[k]));
      if (!sama) gagalPulang ||= `${snap.lab} semai ${semai}: ${kode}`;
    }
  }
  check("tautan: keadaan acak (termasuk sisa memori) pulang utuh", gagalPulang === null, gagalPulang ?? "120 papan");
  const RUSAK = [
    "1s~11~0~1,,,,,,,,,,~", // kapasitas di luar batas
    "1s~3~1~1,2~", // memori kurang
    "1s~3~2~1,2,~", // TopPointer menunjuk sel kosong
    "1s~3~0~1,,~x", // ruas cadangan terisi
    "1s~3~0~a:b,,~", // nilai berisi pemisah
    "1q~m~3~0:1:3~1,2,3", // Rear tidak cocok dengan Front + Number
    "1q~l~3~1:2:1~1,2,3", // linear: Number != Rear - Front + 1
    "1q~x~3~0:-1:0~,,", // jenis tak dikenal
    "1q~m~3~0:-1:0~,", // memori kurang
  ];
  const lolos = RUSAK.filter((r) => decodeLabSnapshot(r) !== null);
  check("tautan rusak ditolak utuh", lolos.length === 0, lolos.join(" ; ") || `${RUSAK.length} tautan`);
  const contoh = decodeLabSnapshot("1q~m~6~4:1:4~7,8,,,5,6");
  check("tautan queue melingkar yang 'membungkus' terbaca", contoh?.lab === "queue" && isiQueue(contoh.state as QueueLabState).map((c) => c.nilai).join() === "5,6,7,8", contoh ? isiQueue(contoh.state as QueueLabState).map((c) => c.nilai).join() : "null");
}

finish();
