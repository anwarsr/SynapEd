/**
 * Menguji RUBRIK INDIVIDU + KELOMPOK BERSAMA pada quiz kelompok: aturan murni lebih dulu, lalu alur penuh lewat
 * dev server (npm run dev) - menerbitkan quiz kelompok berrubrik, memilih anggota (diketik / dari anggota kelas),
 * tombol "Ikuti Quiz", jawaban bersama yang saling terlihat, dan penilaian rubrik tiap anggota.
 *
 *   npx tsx scripts/verify-quiz-rubrik.ts [baseUrl]
 *
 * Yang dijaga:
 *   1. rubrik: jumlah tabel bebas (1-10), terbit butuh judul & poin penilaian terisi;
 *   2. skor 1-4 bilangan bulat untuk poin yang ada; nilai individu = skor / (4 x jumlah poin) x 100, PER ANGGOTA;
 *   3. nilai kelompok = murni poin soal (rubrik TIDAK mengubahnya); soal esai dan TABEL dinilai manual di semua quiz
 *      (tabel tanpa kunci jawaban);
 *   4. status "menunggu penilaian" selama rubrik/esai/tabel belum dinilai (juga menahan peringkat & ekspor);
 *   5. ekspor kelompok: satu baris per anggota, nilai kelompok sama, nilai individu masing-masing;
 *   6. anggota: batas min/maks dari pembuat quiz, duplikat dibuang, nama dari Auth bukan dari browser,
 *      uid di luar kelas ditolak, satu orang satu kelompok;
 *   7. kelompok bersama: satu percobaan, anggota yang diajak harus menekan Ikuti Quiz, jawaban saling terlihat lewat
 *      sinkronJawaban dan tak saling menimpa antarsoal; struktur rubrik terkunci setelah ada yang mengerjakan.
 */
import { getFirestore } from "firebase-admin/firestore";
import { BASE, actionId, app, auth, callAction, check, createTestUser, finish, probe } from "./testSupport";
import { targetLabel } from "./project";
import {
  ANGGOTA_BATAS,
  JUDUL_EKSPOR_KELOMPOK,
  MAX_RUBRIK,
  RUBRIK_AWAL,
  alasanTakBisaEkspor,
  barisEkspor,
  batasAnggota,
  gabungAnggota,
  hitungNilai,
  nilaiIndividu,
  peringkatTeratas,
  percobaanUntuk,
  ringkasRubrik,
  rubrikBaru,
  rubrikStrukturSama,
  statusQuizSiswa,
  sudahIkut,
  tabelBaru,
  toPercobaan,
  toQuiz,
  validasiNilaiEsai,
  validasiQuiz,
  validasiRubrik,
  validasiSkorRubrik,
  type PercobaanQuiz,
  type Quiz,
  type RubrikQuiz,
  type SoalQuiz,
} from "../frontend/src/lib/classQuizRules";

const db = getFirestore(app);

const rubrikSah = (): RubrikQuiz => ({
  tables: [1, 2, 3].map((n) => ({ id: `r${n}`, title: `Rubrik ${n}`, criteria: [{ id: `r${n}a`, text: `Poin ${n}a` }, ...(n === 1 ? [{ id: "r1b", text: "Poin 1b" }] : [])] })),
});
// 4 poin penilaian total: r1a, r1b, r2a, r3a

const mcq = (points: number): SoalQuiz => ({ id: "m1", type: "mcq", text: "Soal", points, options: ["a", "b"].map((o) => ({ id: o, text: o })), correct: "a", table: null });
const soalTabel = (points: number): SoalQuiz => {
  const tb = tabelBaru(1, 2);
  tb.cells.forEach((c) => {
    c.fill = true;
    c.text = "";
    c.key = "";
  });
  return { id: "t1", type: "table", text: "Tabel", points, options: [], correct: null, table: tb };
};

const quizUji = (rubric: RubrikQuiz | null, questions: SoalQuiz[] = [mcq(100)], kelompok = true): Quiz => ({
  id: "q1", classId: "c1", authorUid: "o", title: "Uji", description: "",
  questions,
  settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null, kelompok },
  published: true, bannerURL: null, opensAt: null, closed: false, extraMin: 0, rubric, createdAt: "", updatedAt: "",
});

const coba = (uid: string, over: Partial<PercobaanQuiz> = {}): PercobaanQuiz => ({
  id: `c_q_${uid}`, classId: "c1", quizId: "q1", uid, startedAt: "2026-01-01T00:00:00.000Z",
  submittedAt: "2026-01-01T00:05:00.000Z", finalizedBy: "siswa", answers: { m1: "a" }, order: { q: [], opt: {} }, extraSec: 0, essayScores: {},
  groupName: "Alfa", members: [], rubricScores: {}, joined: [], ...over,
});

const SEMUA_3 = { r1a: 3, r1b: 3, r2a: 3, r3a: 3 };
const SEMUA_4 = { r1a: 4, r1b: 4, r2a: 4, r3a: 4 };
const SEMUA_1 = { r1a: 1, r1b: 1, r2a: 1, r3a: 1 };

function murni() {
  console.log("\nAturan rubrik (murni)");

  check("rubrik awal builder: 3 tabel", rubrikBaru().tables.length === RUBRIK_AWAL, "3 tabel");
  check("terbit: rubrik lengkap lolos", validasiRubrik(rubrikSah(), true).ok, "sah");
  check("rubrik awal kosong lolos sebagai DRAF tetapi tidak saat terbit", validasiRubrik(rubrikBaru(), false).ok && !validasiRubrik(rubrikBaru(), true).ok, "draf ok, terbit ditolak");

  // jumlah tabel BEBAS 1..10 (bukan lagi tepat 3)
  const satu = { tables: rubrikSah().tables.slice(0, 1) };
  check("1 tabel rubrik sah", validasiRubrik(satu, true).ok, "min 1");
  const lima = { tables: Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, title: `R${i}`, criteria: [{ id: `k${i}`, text: "x" }] })) };
  check("5 tabel rubrik sah", validasiRubrik(lima, true).ok, "5");
  check("0 tabel ditolak", !validasiRubrik({ tables: [] }, false).ok, "min 1");
  const sebelas = { tables: Array.from({ length: MAX_RUBRIK + 1 }, (_, i) => ({ id: `t${i}`, title: `R${i}`, criteria: [{ id: `k${i}`, text: "x" }] })) };
  check(`${MAX_RUBRIK + 1} tabel ditolak (maks ${MAX_RUBRIK})`, !validasiRubrik(sebelas, false).ok, "maks 10");

  const idKembar = rubrikSah();
  idKembar.tables[1].criteria[0].id = "r1a";
  check("id poin penilaian kembar ditolak", !validasiRubrik(idKembar, false).ok, "id unik");
  const judulKosong = rubrikSah();
  judulKosong.tables[0].title = "";
  check("terbit: judul rubrik kosong ditolak", !validasiRubrik(judulKosong, true).ok && validasiRubrik(judulKosong, false).ok, "judul wajib saat terbit");
  const banyak = rubrikSah();
  banyak.tables[0].criteria = Array.from({ length: 11 }, (_, i) => ({ id: `x${i}`, text: "t" }));
  check("maksimal 10 poin per tabel", !validasiRubrik(banyak, false).ok, "11 ditolak");

  const kelompok = validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true }, rubric: rubrikSah() }, false);
  check("quiz kelompok menyimpan rubrik", kelompok.ok && kelompok.value.rubric?.tables.length === 3, "tersimpan");
  check("quiz kelompok TANPA rubrik ditolak", !validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true } }, false).ok, "wajib");
  const indiv = validasiQuiz({ title: "Quiz", questions: [], settings: {}, rubric: rubrikSah() }, false);
  check("quiz individu membuang rubrik kiriman", indiv.ok && indiv.value.rubric === null, "null");

  const rb = rubrikSah();
  check("skor sah 1-4", validasiSkorRubrik(rb, { r1a: 1, r1b: 4 })?.r1b === 4, "ok");
  check("skor 0, 5, 2.5, teks, id asing ditolak", [{ r1a: 0 }, { r1a: 5 }, { r1a: 2.5 }, { r1a: "3" }, { zzz: 3 }].every((x) => validasiSkorRubrik(rb, x) === null), "semua ditolak");
  check("skor tanpa rubrik ditolak", validasiSkorRubrik(null, { r1a: 3 }) === null, "tanpa rubrik");

  check("semua 4 → nilai individu 100%", ringkasRubrik(rb, SEMUA_4).persen === 100, "100");
  check("semua 1 → 25%", ringkasRubrik(rb, SEMUA_1).persen === 25, "25%");
  const sebagian = ringkasRubrik(rb, { r1a: 4, r1b: 3 });
  check("sebagian: belum dinilai dihitung, persen null", sebagian.belum === 2 && sebagian.persen === null, `${sebagian.belum}/${sebagian.persen}`);
  check("skor rusak di data dihitung belum dinilai", ringkasRubrik(rb, { r1a: 9, r1b: 3, r2a: 2, r3a: 2 }).belum === 1, "9 diabaikan");

  // nilai kelompok vs nilai individu (PER ANGGOTA)
  const q = quizUji(rb);
  const anggota = [{ uid: "a", name: "Ani", key: "a" }, { uid: "b", name: "Budi", key: "b" }, { uid: null, name: "Cici", key: "m2" }];
  const lengkap = hitungNilai(q, { uid: "a", answers: { m1: "a" }, essayScores: {}, members: anggota, rubricScores: { a: SEMUA_3, b: SEMUA_1, m2: SEMUA_4 } });
  check("nilai kelompok = poin soal (100), tak terpengaruh rubrik", lengkap.total === 100 && lengkap.rubrikBelumDinilai === 0, JSON.stringify([lengkap.total, lengkap.rubrikBelumDinilai]));
  const ni = nilaiIndividu(q, { uid: "a", members: anggota, rubricScores: { a: SEMUA_3, b: SEMUA_1, m2: SEMUA_4 } });
  check("nilai individu per anggota: 75 / 25 / 100", ni.map((x) => x.persen).join() === "75,25,100", ni.map((x) => x.persen).join());
  const pending = hitungNilai(q, { uid: "a", answers: { m1: "a" }, essayScores: {}, members: anggota, rubricScores: { a: SEMUA_3, b: { r1a: 4 } } });
  check("belum dinilai dijumlah lintas anggota (b: 3 poin, Cici: 4 poin = 7)", pending.rubrikBelumDinilai === 7, String(pending.rubrikBelumDinilai));
  const tanpa = hitungNilai(quizUji(null), { answers: { m1: "a" }, essayScores: {} });
  check("tanpa rubrik: nilai soal seperti semula", tanpa.total === 100 && tanpa.rubrikBelumDinilai === 0, "100");
  check("poin soal tetap diatur pengajar (mis. 40/60)", hitungNilai(quizUji(rb, [mcq(40), soalTabel(60)]), { answers: { m1: "a" }, essayScores: { t1: 20 } }).total === 60, "40 + 20");
  check("anggota tanpa daftar (data lama): satu anggota = pemilik", nilaiIndividu(q, { uid: "z", rubricScores: { z: SEMUA_3 } }).map((x) => x.persen).join() === "75", "satu");

  // soal tabel: TANPA kunci, dinilai manual di SEMUA quiz
  const kel = quizUji(rb, [mcq(40), soalTabel(60)], true);
  const jawab = { m1: "a", t1: JSON.stringify({ 0: "x", 1: "y" }) };
  const tabelBelum = hitungNilai(kel, { uid: "a", answers: jawab, essayScores: {}, rubricScores: { a: SEMUA_3 } });
  check("kelompok: tabel MENUNGGU penilaian manual (0 poin, 1 belum dinilai)", tabelBelum.perSoal.t1 === 0 && tabelBelum.esaiBelumDinilai === 1 && tabelBelum.total === 40, JSON.stringify([tabelBelum.perSoal.t1, tabelBelum.esaiBelumDinilai, tabelBelum.total]));
  const tabelSudah = hitungNilai(kel, { uid: "a", answers: jawab, essayScores: { t1: 45 }, rubricScores: { a: SEMUA_3 } });
  check("kelompok: poin tabel dari pengajar dipakai (40 + 45 = 85)", tabelSudah.total === 85 && tabelSudah.esaiBelumDinilai === 0, String(tabelSudah.total));
  const indiv2 = quizUji(null, [mcq(40), soalTabel(60)], false);
  const indivTabel = hitungNilai(indiv2, { answers: jawab, essayScores: {} });
  check("individu: tabel JUGA manual (tanpa kunci): 0 poin, menunggu", indivTabel.perSoal.t1 === 0 && indivTabel.esaiBelumDinilai === 1 && indivTabel.total === 40, JSON.stringify([indivTabel.perSoal.t1, indivTabel.total]));
  check("poin manual tabel sah di kedua jenis quiz", validasiNilaiEsai(kel, { t1: 30 })?.t1 === 30 && validasiNilaiEsai(indiv2, { t1: 30 })?.t1 === 30, "dua-duanya");
  check("poin manual di atas batas soal ditolak", validasiNilaiEsai(kel, { t1: 61 }) === null, "maks 60");
  const lewat = (tabel: ReturnType<typeof tabelBaru>) =>
    validasiQuiz({ title: "Quiz", questions: [{ id: "t1", type: "table", text: "Isi tabel", points: 100, options: [], correct: null, table: tabel }], settings: {} }, true);
  const tb = tabelBaru(1, 2);
  tb.cells[0].fill = true;
  tb.cells[1].fill = true;
  check("terbit: sel isian TANPA kunci lolos", lewat(tb).ok, "tanpa kunci");
  check("terbit: tabel tanpa sel isian tetap ditolak", !lewat(tabelBaru(1, 2)).ok, "perlu isian");
  const dgnKunci = tabelBaru(1, 2);
  dgnKunci.cells[0].fill = true;
  dgnKunci.cells[0].key = "rahasia";
  const hKunci = lewat(dgnKunci);
  check("kunci kiriman lama dibuang (tak pernah tersimpan)", hKunci.ok && (hKunci.value.questions[0].table?.cells ?? []).every((c: { key: string }) => c.key === ""), JSON.stringify(hKunci.ok ? hKunci.value.questions[0].table : hKunci));

  // status, peringkat, ekspor
  const sk = { a: SEMUA_3 };
  check("rubrik belum dinilai → menunggu penilaian", statusQuizSiswa(q, coba("a")) === "perlu_dinilai", "perlu_dinilai");
  check("tabel manual belum dinilai → menunggu penilaian", statusQuizSiswa(kel, coba("a", { answers: jawab, rubricScores: sk })) === "perlu_dinilai", "perlu_dinilai");
  check("semua lengkap → dinilai", statusQuizSiswa(q, coba("a", { rubricScores: sk })) === "dinilai", "dinilai");
  const daftar = [coba("a", { rubricScores: { a: SEMUA_4 } }), coba("b")];
  check("peringkat hanya yang sudah dinilai penuh", peringkatTeratas(q, daftar).map((x) => x.uid).join() === "a", "hanya a");
  check("ekspor ditolak selama rubrik belum dinilai", (alasanTakBisaEkspor(q, daftar) ?? "").includes("1 rubrik individu belum dinilai"), String(alasanTakBisaEkspor(q, daftar)));
  check("ekspor menyebut tabel bila kelompok punya soal tabel", (alasanTakBisaEkspor(kel, [coba("a", { answers: jawab, rubricScores: sk })]) ?? "").includes("esai/tabel belum dinilai"), "esai/tabel");
  check("ekspor boleh bila semua lengkap", alasanTakBisaEkspor(q, [daftar[0]]) === null, "boleh");

  // ekspor: satu baris PER ANGGOTA
  const kelompokP = coba("a", { members: anggota, rubricScores: { a: SEMUA_4, b: SEMUA_1, m2: SEMUA_3 }, groupName: "Alfa" });
  const baris = barisEkspor(q, [
    { nama: "Ani", p: kelompokP, kunci: "a" },
    { nama: "Budi", p: kelompokP, kunci: "b" },
    { nama: "Cici", p: kelompokP, kunci: "m2" },
    { nama: "Dodo", p: null },
  ]);
  check("ekspor kelompok: judul memuat nilai kelompok & nilai individu", JSON.stringify(baris[0]) === JSON.stringify([...JUDUL_EKSPOR_KELOMPOK]) && JUDUL_EKSPOR_KELOMPOK.includes("Nilai kelompok") && JUDUL_EKSPOR_KELOMPOK.some((j) => j.startsWith("Nilai individu")), baris[0].join("|"));
  const per = (n: string) => baris.find((r) => r[1] === n);
  check("ekspor: nilai kelompok SAMA (100), individu beda: Ani 100, Budi 25, Cici 75", per("Ani")?.slice(3, 5).join() === "100,100" && per("Budi")?.slice(3, 5).join() === "100,25" && per("Cici")?.slice(3, 5).join() === "100,75", JSON.stringify(baris.slice(1)));
  check("ekspor: anggota tanpa kelompok = sel kosong", per("Dodo")?.[3] === null && per("Dodo")?.[4] === null, "kosong");

  // anggota & batas
  const diri = { uid: "u1", name: "Aku" };
  check("anggota: sendirian ditolak (bawaan minimal 2)", !gabungAnggota(diri, []).ok, "min 2");
  const dua = gabungAnggota(diri, [{ uid: "u2", name: "Budi" }, { uid: "u2", name: "Budi 2" }, { uid: null, name: "budi" }, { uid: null, name: "Cici" }]);
  check("anggota: duplikat uid/nama dibuang, diri paling depan, tiap anggota ber-key", dua.ok && dua.value.map((m) => m.name).join() === "Aku,Budi,Cici" && dua.value.map((m) => m.key).join() === "u1,u2,m2", dua.ok ? dua.value.map((m) => `${m.name}:${m.key}`).join() : dua.error);
  check("anggota: bawaan maksimal 10", !gabungAnggota(diri, Array.from({ length: 10 }, (_, i) => ({ uid: null, name: `Anggota ${i}` }))).ok, "11 ditolak");
  const lain3 = [{ uid: null, name: "Bobi" }, { uid: null, name: "Cici" }];
  check("batas dari pembuat: minimal 4 menolak 3 orang", !gabungAnggota(diri, lain3, { min: 4, maks: 6 }).ok, "kurang");
  check("batas dari pembuat: 3 orang lolos di 2-3", gabungAnggota(diri, lain3, { min: 2, maks: 3 }).ok, "pas");
  check("batas dari pembuat: maksimal 3 menolak 4 orang", !gabungAnggota(diri, [...lain3, { uid: null, name: "Dewi" }], { min: 2, maks: 3 }).ok, "kelebihan");
  check("batas bawaan bila tak diatur / rusak", JSON.stringify(batasAnggota(undefined)) === '{"min":2,"maks":10}' && batasAnggota({ anggotaMin: 5, anggotaMaks: 3 }).maks === 5 && batasAnggota({ anggotaMin: 1.5 }).min === 2, JSON.stringify(batasAnggota({ anggotaMin: 5, anggotaMaks: 3 })));
  const bs = validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true, anggotaMin: 3, anggotaMaks: 5 }, rubric: rubrikSah() }, false);
  check("validasiQuiz menyimpan batas anggota 3-5", bs.ok && bs.value.settings.anggotaMin === 3 && bs.value.settings.anggotaMaks === 5, JSON.stringify(bs.ok ? bs.value.settings : bs));
  check("min > maks ditolak", !validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true, anggotaMin: 6, anggotaMaks: 4 }, rubric: rubrikSah() }, false).ok, "min>maks");
  check(`maks > ${ANGGOTA_BATAS} ditolak, min < 2 ditolak`, !validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true, anggotaMaks: ANGGOTA_BATAS + 1 }, rubric: rubrikSah() }, false).ok && !validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true, anggotaMin: 1 }, rubric: rubrikSah() }, false).ok, "rentang");
  const defQ = validasiQuiz({ title: "Quiz", questions: [], settings: { kelompok: true }, rubric: rubrikSah() }, false);
  check("tanpa isian: bawaan 2-10", defQ.ok && defQ.value.settings.anggotaMin === 2 && defQ.value.settings.anggotaMaks === 10, "bawaan");
  const indQ = validasiQuiz({ title: "Quiz", questions: [], settings: { anggotaMin: 5 } }, false);
  check("quiz individu tak menyimpan batas anggota", indQ.ok && indQ.value.settings.anggotaMin === undefined, "tanpa");

  // keanggotaan percobaan
  const pk = coba("a", { members: anggota, joined: ["b"] });
  check("percobaanUntuk: pemilik, anggota ber-uid, dan orang luar", percobaanUntuk([pk], "a") === pk && percobaanUntuk([pk], "b") === pk && percobaanUntuk([pk], "zz") === null, "cari lewat anggota");
  check("sudahIkut: pembuat & yang menekan Ikuti saja", sudahIkut(pk, "a") && sudahIkut(pk, "b") && !sudahIkut(pk, "c"), "ikut");

  // struktur & pembaca
  const baru = rubrikSah();
  baru.tables[0].title = "Judul baru";
  check("struktur sama: judul boleh berubah", rubrikStrukturSama(rubrikSah(), baru), "boleh");
  const tambah = rubrikSah();
  tambah.tables[0].criteria.push({ id: "zz", text: "baru" });
  check("struktur beda: tambah poin penilaian ditolak", !rubrikStrukturSama(rubrikSah(), tambah), "terkunci");
  const tambahTabel = rubrikSah();
  tambahTabel.tables.push({ id: "r4", title: "Baru", criteria: [{ id: "r4a", text: "x" }] });
  check("struktur beda: tambah/hapus TABEL rubrik ditolak setelah dikerjakan", !rubrikStrukturSama(rubrikSah(), tambahTabel) && !rubrikStrukturSama(tambahTabel, rubrikSah()), "terkunci");
  const lamaDoc = toQuiz("x", { title: "Lama", questions: [], settings: { kelompok: true } });
  check("dokumen lama tanpa rubrik terbaca null, tak melempar; batas bawaan", lamaDoc.rubric === null && lamaDoc.settings.anggotaMin === 2 && lamaDoc.settings.anggotaMaks === 10, "null");
  const rusak = toQuiz("x", { title: "R", questions: [], rubric: { tables: "x" } });
  check("rubrik rusak di DB terbaca null", rusak.rubric === null, "null");
  const p = toPercobaan("i", { uid: "u", members: [{ uid: "a", name: "A", key: "a" }, { name: "" }, 5], rubricScores: { a: { r1a: 3, r1b: 9, r2a: "x" } }, joined: ["a", 7] });
  check("percobaan: anggota, skor, joined rusak dibersihkan saat dibaca", p.members?.length === 1 && p.members[0].key === "a" && Object.keys(p.rubricScores?.a ?? {}).join() === "r1a" && p.joined?.join() === "a", JSON.stringify([p.members, p.rubricScores, p.joined]));
  const lama = toPercobaan("i", { uid: "u", rubricScores: { r1a: 3, r1b: 2 } });
  check("skor rubrik bentuk LAMA (datar) dibaca sebagai milik pemilik percobaan", lama.rubricScores?.u?.r1a === 3 && lama.rubricScores?.u?.r1b === 2, JSON.stringify(lama.rubricScores));
}

async function alur() {
  const owner = await createTestUser("educator", "rub-pemilik");
  const s1 = await createTestUser("user", "rub-siswa1");
  const s2 = await createTestUser("user", "rub-siswa2");
  const luar = await createTestUser("user", "rub-luar");

  const classId = `rub-${Date.now().toString(36)}`;
  const waktu = new Date().toISOString();
  await db.collection("classes").doc(classId).set({ name: "Uji Rubrik", description: "", ownerUid: owner.uid, joinCode: "UJIRUBRIK", memberCount: 2, postCount: 0, createdAt: waktu, updatedAt: waktu });
  for (const s of [s1, s2]) await db.collection("classMembers").doc(`${s.uid}_${classId}`).set({ uid: s.uid, classId, role: "member", joinedAt: waktu });

  try {
    const jalur = `/educator/classes/${classId}`;
    await probe(jalur, owner.cookie);
    await probe(`${jalur}/quiz/new`, owner.cookie);
    await probe(`/kelas/${classId}/quiz/x`, s1.cookie);
    const simpanId = await actionId("educator/classes/[id]/quiz/new", "saveQuiz");
    const nilaiRubrikId = await actionId("educator/classes/[id]", "gradeQuizRubric");
    const nilaiManualId = await actionId("educator/classes/[id]", "gradeQuizEssay");
    const mulaiId = await actionId("kelas/[id]/quiz/[quizId]", "startQuiz");
    const kirimId = await actionId("kelas/[id]/quiz/[quizId]", "submitQuiz");
    const ikutId = await actionId("kelas/[id]/quiz/[quizId]", "ikutiQuiz");
    const sinkronId = await actionId("kelas/[id]/quiz/[quizId]", "sinkronJawaban");

    const soal = [
      { id: "m1", type: "mcq", text: "Pilihan ganda", points: 60, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: "a", table: null },
      { id: "m2", type: "mcq", text: "Pilihan ganda 2", points: 40, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: "b", table: null },
    ];
    const isi = (over: Record<string, unknown> = {}) => ({ title: "Quiz Rubrik", description: "", questions: soal, rubric: rubrikSah(), settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null, kelompok: true, anggotaMin: 3, anggotaMaks: 3 }, ...over });
    const simpan = (cookie: string, qid: string | null, i: unknown, terbit = true) => callAction(`${jalur}/quiz/new`, simpanId, [classId, qid, i, terbit], cookie);

    console.log("\nMenerbitkan quiz kelompok berrubrik");
    const tanpaRubrik = isi();
    delete (tanpaRubrik as Record<string, unknown>).rubric;
    check("kelompok tanpa rubrik ditolak server", (await simpan(owner.cookie, null, tanpaRubrik)).includes("tabel rubrik"), "wajib rubrik");
    const kosong = rubrikSah();
    kosong.tables[1].criteria[0].text = "";
    check("poin penilaian kosong ditolak saat terbit", (await simpan(owner.cookie, null, isi({ rubric: kosong }))).includes("masih kosong"), "terisi");
    check("batas anggota tak sah ditolak (min 6 > maks 4)", (await simpan(owner.cookie, null, isi({ settings: { kelompok: true, anggotaMin: 6, anggotaMaks: 4 } }))).includes("minimal"), "min>maks");
    check("pemilik menerbitkan (rubrik 4 tabel, batas anggota 3-3)", (await simpan(owner.cookie, null, isi({ rubric: { tables: [...rubrikSah().tables, { id: "r4", title: "Rubrik 4", criteria: [{ id: "r4a", text: "Poin 4a" }] }] } }))).includes("Quiz diterbitkan"), "terbit");
    const docs = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs;
    const quizId = docs[0]?.id ?? "";
    check("rubrik tersimpan di dokumen quiz (4 tabel) beserta batas anggota", docs[0]?.data()?.rubric?.tables?.length === 4 && docs[0]?.data()?.settings?.anggotaMin === 3 && docs[0]?.data()?.settings?.anggotaMaks === 3, "4 tabel");

    const J = (cookie: string, fn: string, args: unknown[]) => callAction(`/kelas/${classId}/quiz/${quizId}`, fn, args, cookie);
    const G = (cookie: string, args: unknown[]) => callAction(jalur, nilaiRubrikId, [classId, quizId, ...args], cookie);
    const docId = (uid: string) => `${classId}_${quizId}_${uid}`;
    const ambil = async (uid: string) => (await db.collection("classQuizAttempts").doc(docId(uid)).get()).data();

    console.log("\nMemilih anggota kelompok (batas dari pembuat quiz: tepat 3)");
    check("hanya 2 orang ditolak (kelompok harus 3)", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [s2.uid] }])).includes("minimal 3"), "kurang");
    check("anggota dari luar kelas ditolak", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [luar.uid, s2.uid] }])).includes("bukan peserta kelas"), "uid asing");
    check("pengajar tak bisa dipilih jadi anggota", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [owner.uid, s2.uid] }])).includes("bukan peserta kelas"), "pengajar ditolak");
    check("nama diketik terlalu pendek ditolak", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [s2.uid], names: ["x"] }])).includes("2-40 karakter"), "min 2");
    check("4 orang ditolak (kelompok maksimal 3)", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [s2.uid], names: ["Cici", "Dodo"] }])).includes("maksimal 3"), "kelebihan");
    check("belum ada percobaan terbentuk dari kiriman yang ditolak", !(await db.collection("classQuizAttempts").doc(docId(s1.uid)).get()).exists, "bersih");
    check("s1 membuat kelompok: memilih s2 dari kelas + mengetik satu nama", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [s2.uid, s1.uid], names: ["Cici"] }])).includes("Quiz dimulai"), "ok");
    const a1 = await ambil(s1.uid);
    const namaS2 = (await auth.getUser(s2.uid)).displayName;
    const m = (a1?.members ?? []) as { uid: string | null; name: string; key: string }[];
    check("anggota tercatat: diri dulu, s2 bernama dari Auth, Cici tanpa uid; masing-masing ber-key", m.length === 3 && m[0].uid === s1.uid && m[1].uid === s2.uid && m[1].name === namaS2 && m[2].uid === null && m[2].name === "Cici" && m[2].key === "m2" && m[1].key === s2.uid, JSON.stringify(m));
    check("skor rubrik awal kosong & belum ada yang ikut selain pembuat", JSON.stringify(a1?.rubricScores) === "{}" && (a1?.joined ?? []).length === 0, JSON.stringify([a1?.rubricScores, a1?.joined]));
    check("s2 TIDAK punya dokumen percobaan sendiri (satu kelompok = satu percobaan)", !(await db.collection("classQuizAttempts").doc(docId(s2.uid)).get()).exists, "satu dokumen");
    check("s2 tak bisa membuat kelompok lain (sudah tergabung)", (await J(s2.cookie, mulaiId, [classId, quizId, "Kelompok B", { names: ["Dodo", "Eko"] }])).includes("sudah tergabung"), "satu orang satu kelompok");

    console.log("\nIkuti Quiz & jawaban bersama");
    check("s2 belum ikut: sinkron ditolak", (await J(s2.cookie, sinkronId, [classId, quizId, { m1: "a" }])).includes("Ikuti Quiz"), "harus ikut dulu");
    check("s2 belum ikut: mengumpulkan ditolak", (await J(s2.cookie, kirimId, [classId, quizId, { m1: "a" }])).includes("Ikuti Quiz"), "harus ikut dulu");
    check("orang luar tak bisa ikut kelompok orang lain", (await J(luar.cookie, ikutId, [classId, quizId])).includes("Hanya peserta kelas"), "bukan anggota kelas");
    check("s2 menekan Ikuti Quiz", (await J(s2.cookie, ikutId, [classId, quizId])).includes("bergabung"), "ikut");
    check("ikut dua kali tetap aman (tidak dobel)", (await J(s2.cookie, ikutId, [classId, quizId])).includes("sudah ikut"), "idempoten");
    check("daftar joined berisi s2 tepat sekali", JSON.stringify((await ambil(s1.uid))?.joined) === JSON.stringify([s2.uid]), JSON.stringify((await ambil(s1.uid))?.joined));

    const sinkron = async (cookie: string, ubah: Record<string, string>) => {
      const teks = await J(cookie, sinkronId, [classId, quizId, ubah]);
      return teks;
    };
    await sinkron(s1.cookie, { m1: "a" });
    const lihatS2 = await sinkron(s2.cookie, {});
    check("s2 MELIHAT jawaban yang ditulis s1 (m1 = a) tanpa menulis apa pun", lihatS2.includes('"m1":"a"'), "dibaca");
    await sinkron(s2.cookie, { m2: "b" });
    const gabung1 = (await ambil(s1.uid))?.answers as Record<string, string>;
    check("jawaban dua anggota di soal BERBEDA sama-sama tersimpan (tak saling menimpa)", gabung1?.m1 === "a" && gabung1?.m2 === "b", JSON.stringify(gabung1));
    await sinkron(s1.cookie, { m1: "b" });
    check("anggota mana pun boleh mengubah soal yang sama (terakhir menang)", ((await ambil(s1.uid))?.answers as Record<string, string>)?.m1 === "b", "diubah");
    await sinkron(s2.cookie, { m1: "a" });

    check("s2 mengumpulkan untuk seluruh kelompok", (await J(s2.cookie, kirimId, [classId, quizId, {}])).includes("Quiz dikumpulkan"), "kumpul");
    const akhir = await ambil(s1.uid);
    check("terkumpul: jawaban terakhir di server dipakai (tak ditimpa kiriman kosong)", Boolean(akhir?.submittedAt) && (akhir?.answers as Record<string, string>)?.m1 === "a" && (akhir?.answers as Record<string, string>)?.m2 === "b", JSON.stringify(akhir?.answers));
    check("s1 (pembuat) diberi tahu kelompok sudah selesai", (await sinkron(s1.cookie, {})).includes('"selesai":true'), "selesai");
    await sinkron(s1.cookie, { m1: "b" });
    check("setelah terkumpul, perubahan baru tidak tertulis", ((await ambil(s1.uid))?.answers as Record<string, string>)?.m1 === "a", "tetap a");

    const baca = async () => {
      const d = await db.collection("classQuizAttempts").doc(docId(s1.uid)).get();
      const quiz = toQuiz(quizId, (await db.collection("classes").doc(classId).collection("quizzes").doc(quizId).get()).data() ?? {});
      const p = toPercobaan(d.id, d.data() ?? {});
      return { quiz, p, n: hitungNilai(quiz, p), status: statusQuizSiswa(quiz, p), ni: nilaiIndividu(quiz, p) };
    };

    console.log("\nMenilai rubrik tiap ANGGOTA (nilai individu)");
    let r = await baca();
    check("terkumpul tetapi menunggu rubrik (nilai kelompok 100 sudah ada; 5 poin x 3 anggota belum dinilai)", r.status === "perlu_dinilai" && r.n.total === 100 && r.n.rubrikBelumDinilai === 15, JSON.stringify([r.status, r.n.total, r.n.rubrikBelumDinilai]));
    check("siswa tak bisa menilai rubrik", (await G(s1.cookie, [s1.uid, s1.uid, { r1a: 4 }])).includes("tidak berhak"), "penjaga pemilik");
    check("skor 5 ditolak", (await G(owner.cookie, [s1.uid, s1.uid, { r1a: 5 }])).includes("tidak sah"), "1-4");
    check("id poin asing ditolak", (await G(owner.cookie, [s1.uid, s1.uid, { zzz: 3 }])).includes("tidak sah"), "id asing");
    check("anggota yang bukan bagian kelompok ditolak", (await G(owner.cookie, [s1.uid, luar.uid, { r1a: 3 }])).includes("bukan bagian dari kelompok"), "kunci asing");
    const penuh = { r1a: 3, r1b: 3, r2a: 3, r3a: 3, r4a: 3 };
    const rendah = { r1a: 1, r1b: 1, r2a: 1, r3a: 1, r4a: 1 };
    check("pengajar menyimpan sebagian untuk s1", (await G(owner.cookie, [s1.uid, s1.uid, { r1a: 3, r1b: 3 }])).includes("Skor rubrik disimpan"), "sebagian");
    r = await baca();
    check("sebagian: masih menunggu; belum dinilai s1 = 3, s2 = 5, Cici = 5", r.status === "perlu_dinilai" && r.n.rubrikBelumDinilai === 13, String(r.n.rubrikBelumDinilai));
    check("menyimpan sisa s1 (lewat s2 sebagai pintu, kunci s1)", (await G(owner.cookie, [s2.uid, s1.uid, { r2a: 3, r3a: 3, r4a: 3 }])).includes("Skor rubrik disimpan"), "lengkap");
    check("s2 dinilai 25% (terpisah dari s1)", (await G(owner.cookie, [s1.uid, s2.uid, rendah])).includes("Skor rubrik disimpan"), "s2");
    r = await baca();
    check("s1 75% dan s2 25% BERDIRI SENDIRI; Cici belum dinilai → menunggu", r.ni.find((x) => x.uid === s1.uid)?.persen === 75 && r.ni.find((x) => x.uid === s2.uid)?.persen === 25 && r.ni.find((x) => x.uid === null)?.persen === null && r.status === "perlu_dinilai", JSON.stringify(r.ni.map((x) => [x.nama, x.persen])));
    check("Cici (tanpa akun) dinilai lewat kunci m2", (await G(owner.cookie, [s1.uid, "m2", penuh])).includes("Skor rubrik disimpan"), "m2");
    r = await baca();
    check("semua anggota dinilai → status dinilai; nilai kelompok tetap 100, TAK berubah oleh rubrik", r.status === "dinilai" && r.n.total === 100 && r.n.rubrikBelumDinilai === 0, JSON.stringify([r.status, r.n.total, r.n.rubrikBelumDinilai]));

    console.log("\nQuiz yang sudah dikerjakan: rubrik terkunci");
    const tambah = rubrikSah();
    tambah.tables[0].criteria.push({ id: "zz", text: "Baru" });
    const rubrik4 = { tables: [...rubrikSah().tables, { id: "r4", title: "Rubrik 4", criteria: [{ id: "r4a", text: "Poin 4a" }] }] };
    check("poin penilaian tak bisa ditambah", (await simpan(owner.cookie, quizId, isi({ rubric: { tables: [{ ...rubrik4.tables[0], criteria: [...rubrik4.tables[0].criteria, { id: "zz", text: "Baru" }] }, ...rubrik4.tables.slice(1)] } }))).includes("tidak bisa ditambah atau dihapus"), "terkunci");
    check("tabel rubrik tak bisa dihapus", (await simpan(owner.cookie, quizId, isi({ rubric: rubrikSah() }))).includes("tidak bisa ditambah atau dihapus"), "terkunci");
    const judulBaru = { tables: rubrik4.tables.map((t, i) => (i === 0 ? { ...t, title: "Kerja sama tim" } : t)) };
    check("judul rubrik masih bisa diubah", (await simpan(owner.cookie, quizId, isi({ rubric: judulBaru }))).includes("Quiz diterbitkan"), "boleh");
    r = await baca();
    check("mengubah judul tak mengubah nilai individu maupun kelompok", r.n.total === 100 && r.ni.find((x) => x.uid === s1.uid)?.persen === 75, JSON.stringify([r.n.total, r.ni.map((x) => x.persen)]));

    console.log("\nQuiz individu tanpa rubrik");
    check("individu diterbitkan (rubrik & batas anggota diabaikan)", (await simpan(owner.cookie, null, isi({ title: "Individu", settings: { kelompok: false, anggotaMin: 5 } }))).includes("Quiz diterbitkan"), "terbit");
    const dokIndiv = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs.find((d) => d.data().title === "Individu");
    const idIndiv = dokIndiv?.id ?? "";
    check("dokumen individu tanpa rubrik & tanpa batas anggota", dokIndiv?.data()?.rubric === null && dokIndiv?.data()?.settings?.anggotaMin === undefined, "null");
    await callAction(`/kelas/${classId}/quiz/${idIndiv}`, mulaiId, [classId, idIndiv], s2.cookie);
    await callAction(`/kelas/${classId}/quiz/${idIndiv}`, kirimId, [classId, idIndiv, { m1: "a" }], s2.cookie);
    check("menilai rubrik di quiz individu ditolak", (await callAction(jalur, nilaiRubrikId, [classId, idIndiv, s2.uid, s2.uid, { r1a: 3 }], owner.cookie)).includes("tidak memakai rubrik"), "ditolak");
    check("poin manual esai tetap lewat gradeQuizEssay (penjaga pemilik)", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { m1: 1 }], s1.cookie)).includes("tidak berhak"), "penjaga");
  } finally {
    for (const s of await db.collection("classes").doc(classId).collection("quizzes").get().then((x) => x.docs)) {
      await db.collection("classes").doc(classId).collection("quizzes").doc(s.id).delete();
      for (const u of [s1, s2, luar]) await db.collection("classQuizAttempts").doc(`${classId}_${s.id}_${u.uid}`).delete().catch(() => undefined);
    }
    for (const u of [s1, s2]) await db.collection("classMembers").doc(`${u.uid}_${classId}`).delete().catch(() => undefined);
    await db.collection("classes").doc(classId).delete().catch(() => undefined);
    for (const u of [owner, s1, s2, luar]) await auth.deleteUser(u.uid).catch(() => undefined);
  }
}

async function main() {
  console.log(`Target: ${targetLabel()}  |  server: ${BASE}`);
  murni();
  await alur();
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
