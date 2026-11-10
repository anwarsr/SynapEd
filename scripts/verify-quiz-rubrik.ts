/**
 * Menguji RUBRIK INDIVIDU quiz kelompok: aturan murni lebih dulu, lalu alur penuh lewat dev server
 * (npm run dev) - menerbitkan quiz kelompok berrubrik, memilih anggota (diketik / dari anggota kelas),
 * menilai rubrik tiap siswa, dan memastikan NILAI KELOMPOK (poin soal) dan NILAI INDIVIDU (rubrik) berdiri sendiri.
 *
 *   npx tsx scripts/verify-quiz-rubrik.ts [baseUrl]
 *
 * Yang dijaga:
 *   1. bentuk rubrik: tepat 3 tabel, terbit butuh judul & poin penilaian terisi;
 *   2. skor 1-4 bilangan bulat untuk poin yang ada; nilai individu = skor / (4 x jumlah poin) x 100;
 *   3. nilai kelompok = murni poin soal (rubrik TIDAK mengubahnya); soal esai dan TABEL pada quiz kelompok dinilai
 *      manual (menunggu persetujuan pengajar), pada quiz individu tabel tetap otomatis;
 *   4. status "menunggu penilaian" selama rubrik/esai/tabel belum dinilai (juga menahan peringkat & ekspor);
 *   5. ekspor kelompok memuat kolom nilai kelompok DAN nilai individu;
 *   6. anggota: minimal 2 orang termasuk pembuat, duplikat dibuang, nama dari Auth bukan dari browser,
 *      uid di luar kelas ditolak; 7. struktur rubrik terkunci setelah ada yang mengerjakan.
 */
import { getFirestore } from "firebase-admin/firestore";
import { BASE, actionId, app, auth, callAction, check, createTestUser, finish, probe } from "./testSupport";
import { targetLabel } from "./project";
import {
  JUDUL_EKSPOR_KELOMPOK,
  JUMLAH_RUBRIK,
  alasanTakBisaEkspor,
  barisEkspor,
  gabungAnggota,
  hitungNilai,
  peringkatTeratas,
  ringkasRubrik,
  rubrikBaru,
  rubrikStrukturSama,
  statusQuizSiswa,
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
    c.key = "x";
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
  groupName: "Alfa", members: [], rubricScores: {}, ...over,
});

const SEMUA_3 = { r1a: 3, r1b: 3, r2a: 3, r3a: 3 };

function murni() {
  console.log("\nAturan rubrik (murni)");

  check("rubrik awal builder: 3 tabel", rubrikBaru().tables.length === JUMLAH_RUBRIK, "3 tabel");
  check("terbit: rubrik lengkap lolos", validasiRubrik(rubrikSah(), true).ok, "sah");
  check("rubrik awal kosong lolos sebagai DRAF tetapi tidak saat terbit", validasiRubrik(rubrikBaru(), false).ok && !validasiRubrik(rubrikBaru(), true).ok, "draf ok, terbit ditolak");

  const duaTabel = { tables: rubrikSah().tables.slice(0, 2) };
  check("hanya 2 tabel ditolak", !validasiRubrik(duaTabel, false).ok, "harus 3");
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

  check("semua 4 → nilai individu 100%", ringkasRubrik(rb, { r1a: 4, r1b: 4, r2a: 4, r3a: 4 }).persen === 100, "100");
  check("semua 1 → 25%", ringkasRubrik(rb, { r1a: 1, r1b: 1, r2a: 1, r3a: 1 }).persen === 25, "25%");
  const sebagian = ringkasRubrik(rb, { r1a: 4, r1b: 3 });
  check("sebagian: belum dinilai dihitung, persen null", sebagian.belum === 2 && sebagian.persen === null, `${sebagian.belum}/${sebagian.persen}`);
  check("skor rusak di data dihitung belum dinilai", ringkasRubrik(rb, { r1a: 9, r1b: 3, r2a: 2, r3a: 2 }).belum === 1, "9 diabaikan");

  // nilai kelompok vs nilai individu
  const q = quizUji(rb);
  const lengkap = hitungNilai(q, { answers: { m1: "a" }, essayScores: {}, rubricScores: SEMUA_3 });
  check("nilai kelompok = poin soal (100), nilai individu = 75%", lengkap.total === 100 && lengkap.rubrikPersen === 75, JSON.stringify([lengkap.total, lengkap.rubrikPersen]));
  const rendah = hitungNilai(q, { answers: { m1: "a" }, essayScores: {}, rubricScores: { r1a: 1, r1b: 1, r2a: 1, r3a: 1 } });
  check("rubrik TIDAK mengubah nilai kelompok (tetap 100, individu 25%)", rendah.total === 100 && rendah.rubrikPersen === 25, JSON.stringify([rendah.total, rendah.rubrikPersen]));
  const salah = hitungNilai(q, { answers: { m1: "b" }, essayScores: {}, rubricScores: { r1a: 4, r1b: 4, r2a: 4, r3a: 4 } });
  check("kuis 0 tetap 0 walau rubrik 100%", salah.total === 0 && salah.rubrikPersen === 100, JSON.stringify([salah.total, salah.rubrikPersen]));
  const pending = hitungNilai(q, { answers: { m1: "a" }, essayScores: {}, rubricScores: { r1a: 4 } });
  check("rubrik belum lengkap: 3 poin belum dinilai, individu null", pending.rubrikBelumDinilai === 3 && pending.rubrikPersen === null, JSON.stringify([pending.rubrikBelumDinilai, pending.rubrikPersen]));
  const tanpa = hitungNilai(quizUji(null), { answers: { m1: "a" }, essayScores: {} });
  check("tanpa rubrik: nilai soal seperti semula", tanpa.total === 100 && tanpa.rubrikBelumDinilai === 0 && tanpa.rubrikPersen === null, "100");
  check("poin soal tetap diatur pengajar (mis. 40/60)", hitungNilai(quizUji(rb, [mcq(40), { ...soalTabel(60), id: "t1" }]), { answers: { m1: "a" }, essayScores: { t1: 20 } }).total === 60, "40 + 20");

  // soal manual: esai & TABEL pada quiz kelompok
  const kel = quizUji(rb, [mcq(40), soalTabel(60)], true);
  const jawab = { m1: "a", t1: JSON.stringify({ 0: "x", 1: "y" }) };
  const tabelBelum = hitungNilai(kel, { answers: jawab, essayScores: {}, rubricScores: SEMUA_3 });
  check("kelompok: tabel MENUNGGU penilaian manual (0 poin, 1 belum dinilai)", tabelBelum.perSoal.t1 === 0 && tabelBelum.esaiBelumDinilai === 1 && tabelBelum.total === 40, JSON.stringify([tabelBelum.perSoal.t1, tabelBelum.esaiBelumDinilai, tabelBelum.total]));
  const tabelSudah = hitungNilai(kel, { answers: jawab, essayScores: { t1: 45 }, rubricScores: SEMUA_3 });
  check("kelompok: poin tabel dari pengajar dipakai (40 + 45 = 85)", tabelSudah.total === 85 && tabelSudah.esaiBelumDinilai === 0, String(tabelSudah.total));
  const indivTabel = hitungNilai(quizUji(null, [mcq(40), soalTabel(60)], false), { answers: jawab, essayScores: {} });
  check("individu: tabel tetap otomatis (1/2 sel x 60 = 30 + 40)", indivTabel.perSoal.t1 === 30 && indivTabel.esaiBelumDinilai === 0 && indivTabel.total === 70, JSON.stringify([indivTabel.perSoal.t1, indivTabel.total]));
  check("poin manual tabel sah untuk kelompok, ditolak untuk individu", validasiNilaiEsai(kel, { t1: 30 })?.t1 === 30 && validasiNilaiEsai(quizUji(null, [mcq(40), soalTabel(60)], false), { t1: 30 }) === null, "kelompok saja");
  check("poin manual di atas batas soal ditolak", validasiNilaiEsai(kel, { t1: 61 }) === null, "maks 60");

  // status, peringkat, ekspor
  check("rubrik belum dinilai → menunggu penilaian", statusQuizSiswa(q, coba("a")) === "perlu_dinilai", "perlu_dinilai");
  check("tabel manual belum dinilai → menunggu penilaian", statusQuizSiswa(kel, coba("a", { answers: jawab, rubricScores: SEMUA_3 })) === "perlu_dinilai", "perlu_dinilai");
  check("semua lengkap → dinilai", statusQuizSiswa(q, coba("a", { rubricScores: SEMUA_3 })) === "dinilai", "dinilai");
  const daftar = [coba("a", { rubricScores: { r1a: 4, r1b: 4, r2a: 4, r3a: 4 } }), coba("b")];
  check("peringkat hanya yang sudah dinilai penuh", peringkatTeratas(q, daftar).map((x) => x.uid).join() === "a", "hanya a");
  check("ekspor ditolak selama rubrik belum dinilai", (alasanTakBisaEkspor(q, daftar) ?? "").includes("1 rubrik individu belum dinilai"), String(alasanTakBisaEkspor(q, daftar)));
  check("ekspor menyebut tabel bila kelompok punya soal tabel", (alasanTakBisaEkspor(kel, [coba("a", { answers: jawab, rubricScores: SEMUA_3 })]) ?? "").includes("esai/tabel belum dinilai"), "esai/tabel");
  check("ekspor boleh bila semua lengkap", alasanTakBisaEkspor(q, [daftar[0]]) === null, "boleh");

  const baris = barisEkspor(q, [
    { nama: "Budi", p: coba("a", { rubricScores: { r1a: 4, r1b: 4, r2a: 4, r3a: 4 }, groupName: "Alfa" }) },
    { nama: "Ani", p: coba("b", { rubricScores: { r1a: 1, r1b: 1, r2a: 1, r3a: 1 }, answers: { m1: "b" }, groupName: "Alfa" }) },
    { nama: "Cici", p: null },
  ]);
  check("ekspor kelompok: judul memuat nilai kelompok & nilai individu", JSON.stringify(baris[0]) === JSON.stringify([...JUDUL_EKSPOR_KELOMPOK]) && JUDUL_EKSPOR_KELOMPOK.includes("Nilai kelompok") && JUDUL_EKSPOR_KELOMPOK.some((j) => j.startsWith("Nilai individu")), baris[0].join("|"));
  check("ekspor kelompok: Budi 100 / 100, Ani 0 / 25, Cici kosong", JSON.stringify(baris[1].slice(3, 5)) === "[100,100]" && JSON.stringify(baris[2].slice(3, 5)) === "[0,25]" && baris[3][3] === null && baris[3][4] === null, JSON.stringify(baris.slice(1)));

  // anggota
  const diri = { uid: "u1", name: "Aku" };
  check("anggota: sendirian ditolak (minimal 2)", !gabungAnggota(diri, []).ok, "min 2");
  const dua = gabungAnggota(diri, [{ uid: "u2", name: "Budi" }, { uid: "u2", name: "Budi 2" }, { uid: null, name: "budi" }, { uid: null, name: "Cici" }]);
  check("anggota: duplikat uid/nama dibuang, diri paling depan", dua.ok && dua.value.map((m) => m.name).join() === "Aku,Budi,Cici", dua.ok ? dua.value.map((m) => m.name).join() : dua.error);
  check("anggota: maksimal 10", !gabungAnggota(diri, Array.from({ length: 10 }, (_, i) => ({ uid: null, name: `Anggota ${i}` }))).ok, "11 ditolak");

  // struktur & pembaca
  const baru = rubrikSah();
  baru.tables[0].title = "Judul baru";
  check("struktur sama: judul boleh berubah", rubrikStrukturSama(rubrikSah(), baru), "boleh");
  const tambah = rubrikSah();
  tambah.tables[0].criteria.push({ id: "zz", text: "baru" });
  check("struktur beda: tambah poin penilaian ditolak", !rubrikStrukturSama(rubrikSah(), tambah), "terkunci");
  const lamaDoc = toQuiz("x", { title: "Lama", questions: [], settings: { kelompok: true } });
  check("dokumen lama tanpa rubrik terbaca null, tak melempar", lamaDoc.rubric === null, "null");
  const rusak = toQuiz("x", { title: "R", questions: [], rubric: { tables: "x" } });
  check("rubrik rusak di DB terbaca null", rusak.rubric === null, "null");
  const p = toPercobaan("i", { uid: "u", members: [{ uid: "a", name: "A" }, { name: "" }, 5], rubricScores: { r1a: 3, r1b: 9, r2a: "x" } });
  check("percobaan: anggota & skor rusak dibersihkan saat dibaca", p.members?.length === 1 && Object.keys(p.rubricScores ?? {}).join() === "r1a", JSON.stringify([p.members, p.rubricScores]));
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

    const soal = [{ id: "m1", type: "mcq", text: "Pilihan ganda", points: 100, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct: "a", table: null }];
    const isi = (over: Record<string, unknown> = {}) => ({ title: "Quiz Rubrik", description: "", questions: soal, rubric: rubrikSah(), settings: { shuffleQuestions: false, shuffleOptions: false, durationMin: null, kelompok: true }, ...over });
    const simpan = (cookie: string, qid: string | null, i: unknown, terbit = true) => callAction(`${jalur}/quiz/new`, simpanId, [classId, qid, i, terbit], cookie);

    console.log("\nMenerbitkan quiz kelompok berrubrik");
    const tanpaRubrik = isi();
    delete (tanpaRubrik as Record<string, unknown>).rubric;
    check("kelompok tanpa rubrik ditolak server", (await simpan(owner.cookie, null, tanpaRubrik)).includes("3 tabel rubrik"), "wajib rubrik");
    const kosong = rubrikSah();
    kosong.tables[1].criteria[0].text = "";
    check("poin penilaian kosong ditolak saat terbit", (await simpan(owner.cookie, null, isi({ rubric: kosong }))).includes("masih kosong"), "terisi");
    check("pemilik menerbitkan", (await simpan(owner.cookie, null, isi())).includes("Quiz diterbitkan"), "terbit");
    const docs = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs;
    const quizId = docs[0]?.id ?? "";
    check("rubrik tersimpan di dokumen quiz", docs[0]?.data()?.rubric?.tables?.length === 3, "3 tabel");

    const J = (cookie: string, fn: string, args: unknown[]) => callAction(`/kelas/${classId}/quiz/${quizId}`, fn, args, cookie);
    const G = (cookie: string, args: unknown[]) => callAction(jalur, nilaiRubrikId, [classId, quizId, ...args], cookie);

    console.log("\nMemilih anggota kelompok");
    check("tanpa anggota lain ditolak", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A"])).includes("minimal satu anggota"), "min 2");
    check("anggota dari luar kelas ditolak", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [luar.uid] }])).includes("bukan peserta kelas"), "uid asing");
    check("pengajar tak bisa dipilih jadi anggota", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [owner.uid] }])).includes("bukan peserta kelas"), "pengajar ditolak");
    check("nama diketik terlalu pendek ditolak", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { names: ["x"] }])).includes("2-40 karakter"), "min 2");
    check("belum ada percobaan terbentuk dari kiriman ditolak", !(await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).exists, "bersih");
    check("s1 mulai: memilih s2 dari anggota kelas + mengetik satu nama", (await J(s1.cookie, mulaiId, [classId, quizId, "Kelompok A", { uids: [s2.uid, s1.uid], names: ["Cici"] }])).includes("Quiz dimulai"), "ok");
    const a1 = (await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${s1.uid}`).get()).data();
    const namaS2 = (await auth.getUser(s2.uid)).displayName;
    const m = (a1?.members ?? []) as { uid: string | null; name: string }[];
    check("anggota tercatat: diri dulu, s2 bernama dari Auth, Cici tanpa uid", m.length === 3 && m[0].uid === s1.uid && m[1].uid === s2.uid && m[1].name === namaS2 && m[2].uid === null && m[2].name === "Cici", JSON.stringify(m));
    check("skor rubrik awal kosong", JSON.stringify(a1?.rubricScores) === "{}", "{}");
    check("s2 mulai dengan cara mengetik saja", (await J(s2.cookie, mulaiId, [classId, quizId, "Kelompok A", { names: ["Dodo"] }])).includes("Quiz dimulai"), "ok");

    await J(s1.cookie, kirimId, [classId, quizId, { m1: "a" }]);
    await J(s2.cookie, kirimId, [classId, quizId, { m1: "b" }]);

    const baca = async (uid: string) => {
      const d = await db.collection("classQuizAttempts").doc(`${classId}_${quizId}_${uid}`).get();
      const quiz = toQuiz(quizId, (await db.collection("classes").doc(classId).collection("quizzes").doc(quizId).get()).data() ?? {});
      const p = toPercobaan(d.id, d.data() ?? {});
      return { quiz, p, n: hitungNilai(quiz, p), status: statusQuizSiswa(quiz, p) };
    };

    console.log("\nMenilai rubrik tiap siswa (nilai individu)");
    let r = await baca(s1.uid);
    check("terkumpul tetapi menunggu rubrik (nilai kelompok 100 sudah ada)", r.status === "perlu_dinilai" && r.n.total === 100 && r.n.rubrikBelumDinilai === 4, JSON.stringify([r.status, r.n.total, r.n.rubrikBelumDinilai]));
    check("siswa tak bisa menilai rubrik", (await G(s1.cookie, [s1.uid, { r1a: 4 }])).includes("tidak berhak"), "penjaga pemilik");
    check("skor 5 ditolak", (await G(owner.cookie, [s1.uid, { r1a: 5 }])).includes("tidak sah"), "1-4");
    check("id poin asing ditolak", (await G(owner.cookie, [s1.uid, { zzz: 3 }])).includes("tidak sah"), "id asing");
    check("pengajar menyimpan sebagian", (await G(owner.cookie, [s1.uid, { r1a: 3, r1b: 3 }])).includes("Skor rubrik disimpan"), "sebagian");
    r = await baca(s1.uid);
    check("sebagian: masih menunggu & 2 poin belum", r.status === "perlu_dinilai" && r.n.rubrikBelumDinilai === 2, String(r.n.rubrikBelumDinilai));
    check("menyimpan sisanya", (await G(owner.cookie, [s1.uid, { r2a: 3, r3a: 3 }])).includes("Skor rubrik disimpan"), "lengkap");
    r = await baca(s1.uid);
    check("s1: nilai kelompok 100 dan nilai individu 75% BERDIRI SENDIRI", r.status === "dinilai" && r.n.total === 100 && r.n.rubrikPersen === 75, JSON.stringify([r.status, r.n.total, r.n.rubrikPersen]));
    await G(owner.cookie, [s2.uid, { r1a: 1, r1b: 1, r2a: 1, r3a: 1 }]);
    r = await baca(s2.uid);
    check("s2: nilai kelompok 0 dan nilai individu 25% (dinilai terpisah dari s1)", r.status === "dinilai" && r.n.total === 0 && r.n.rubrikPersen === 25, JSON.stringify([r.status, r.n.total, r.n.rubrikPersen]));

    console.log("\nQuiz yang sudah dikerjakan: rubrik terkunci");
    const tambah = rubrikSah();
    tambah.tables[0].criteria.push({ id: "zz", text: "Baru" });
    check("poin penilaian tak bisa ditambah", (await simpan(owner.cookie, quizId, isi({ rubric: tambah }))).includes("tidak bisa ditambah atau dihapus"), "terkunci");
    const judulBaru = rubrikSah();
    judulBaru.tables[0].title = "Kerja sama tim";
    check("judul rubrik masih bisa diubah", (await simpan(owner.cookie, quizId, isi({ rubric: judulBaru }))).includes("Quiz diterbitkan"), "boleh");
    r = await baca(s1.uid);
    check("mengubah judul tak mengubah nilai individu maupun kelompok", r.n.total === 100 && r.n.rubrikPersen === 75, JSON.stringify([r.n.total, r.n.rubrikPersen]));

    console.log("\nQuiz individu tanpa rubrik");
    check("individu diterbitkan (rubrik diabaikan)", (await simpan(owner.cookie, null, isi({ title: "Individu", settings: { kelompok: false } }))).includes("Quiz diterbitkan"), "terbit");
    const idIndiv = (await db.collection("classes").doc(classId).collection("quizzes").get()).docs.find((d) => d.data().title === "Individu")?.id ?? "";
    check("dokumen individu tanpa rubrik", (await db.collection("classes").doc(classId).collection("quizzes").doc(idIndiv).get()).data()?.rubric === null, "null");
    await callAction(`/kelas/${classId}/quiz/${idIndiv}`, mulaiId, [classId, idIndiv], s2.cookie);
    await callAction(`/kelas/${classId}/quiz/${idIndiv}`, kirimId, [classId, idIndiv, { m1: "a" }], s2.cookie);
    check("menilai rubrik di quiz individu ditolak", (await callAction(jalur, nilaiRubrikId, [classId, idIndiv, s2.uid, { r1a: 3 }], owner.cookie)).includes("tidak memakai rubrik"), "ditolak");
    check("poin manual esai tetap lewat gradeQuizEssay (penjaga pemilik)", (await callAction(jalur, nilaiManualId, [classId, quizId, s1.uid, { m1: 1 }], s1.cookie)).includes("tidak berhak"), "penjaga");
  } finally {
    for (const s of await db.collection("classes").doc(classId).collection("quizzes").get().then((x) => x.docs)) {
      await db.collection("classes").doc(classId).collection("quizzes").doc(s.id).delete();
      for (const u of [s1, s2]) await db.collection("classQuizAttempts").doc(`${classId}_${s.id}_${u.uid}`).delete().catch(() => undefined);
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
