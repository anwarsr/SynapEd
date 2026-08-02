// Data untuk landing page — dikonversi dari HomeController.php

export interface Stat {
  value: string;
  label: string;
  icon: string;
}

export interface Partner {
  name: string;
  abbr: string;
}

export interface Testimonial {
  name: string;
  position: string;
  content: string;
  rating: number;
  image: string;
  work_image: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface CourseCategory {
  slug: string;
  label: string;
}

export const courseCategories: CourseCategory[] = [
  { slug: 'semua', label: 'Semua Materi' },
  { slug: 'neuroscience', label: 'Neuroscience' },
  { slug: 'eeg', label: 'Teknologi EEG' },
  { slug: 'analisis', label: 'Analisis Data' },
];

export const stats: Stat[] = [
  { value: '1000+', label: 'Pelajar Terdaftar', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { value: '10+', label: 'Kategori Ilmu', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { value: '50+', label: 'Jam Konten Video', icon: 'M15 10l4.553-2.069A1 1 0 0121 8.873v6.254a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { value: '4.8★', label: 'Rating Rata-rata', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
];

export const partners: Partner[] = [
  { name: 'Universitas Indonesia', abbr: 'UI' },
  { name: 'Institut Teknologi Bandung', abbr: 'ITB' },
  { name: 'Universitas Gadjah Mada', abbr: 'UGM' },
  { name: 'BRIN', abbr: 'BRIN' },
  { name: 'Institut Teknologi Sepuluh Nov.', abbr: 'ITS' },
  { name: 'Universitas Brawijaya', abbr: 'UB' },
  { name: 'Universitas Diponegoro', abbr: 'UNDIP' },
  { name: 'Universitas Airlangga', abbr: 'UNAIR' },
];

export const testimonials: Testimonial[] = [
  {
    name: 'Anak Senku',
    position: 'Mahasiswa Teknik Biomedik',
    content: 'Materi di SynapEd disajikan dengan sangat sistematis. Saya bisa memahami berbagai topik kompleks dari nol dengan mudah.',
    rating: 5,
    image: '/images/2.jpeg',
    work_image: 'https://rsa.ugm.ac.id/wp-content/uploads/sites/60/eeg_40_channel_rsa_ugm_2.jpg',
  },
  {
    name: 'Pengguna Aktif',
    position: 'Tenaga Pendidik',
    content: 'Kontennya informatif dan terstruktur. Sangat membantu saya dalam mempersiapkan materi pembelajaran untuk siswa saya.',
    rating: 5,
    image: '/images/mikey.jpeg',
    work_image: 'https://rsa.ugm.ac.id/wp-content/uploads/sites/60/eeg_40_channel_rsa_ugm_3.jpg',
  },
  {
    name: 'King Olga 67',
    position: 'Ilmuan Internasional',
    content: 'Modulnya sangat cocok untuk siapa saja yang ingin memperdalam ilmu di berbagai bidang.',
    rating: 5,
    image: '/images/king.png',
    work_image: 'https://imotions.com/wp-content/uploads/2022/10/EEG-Visuals.jpg',
  },
  {
    name: 'Reza N',
    position: 'Penjelajah',
    content: 'Bahasa yang digunakan pada modul sangat mudah dipahami, bahkan untuk saya yang awam sekalipun.',
    rating: 5,
    image: '/images/reja.jpeg',
    work_image: 'https://glomeda.co.id/wp-content/uploads/2021/08/Pemeriksaan-EEG-800x475.jpg',
  },
  {
    name: 'Ardik A',
    position: 'Mandor Sawit',
    content: 'Modulnya sangat mudah dipahami. Saya merasa lebih percaya diri untuk mulai belajar hal-hal baru di SynapEd.',
    rating: 5,
    image: '/images/1.jpeg',
    work_image: 'https://portal.riau24.com/news/20220223/riau24_1645581863.png',
  },
  {
    name: 'Alumni Kursus',
    position: 'Peneliti & Praktisi',
    content: 'Modul-modul di SynapEd sangat praktis. Panduan dan studi kasusnya langsung bisa diterapkan pada pekerjaan saya. Sangat direkomendasikan.',
    rating: 5,
    image: '/images/logo.png',
    work_image: 'https://rsa.ugm.ac.id/wp-content/uploads/sites/60/eeg_40_channel_rsa_ugm_5.jpg',
  },
];

export const faqs: FAQ[] = [
  {
    question: 'Siapa saja yang dapat menggunakan platform SynapEd?',
    answer: 'SynapEd terbuka untuk semua kalangan — pelajar SMA, SMK, mahasiswa, hingga profesional yang ingin memperdalam berbagai bidang ilmu. Tidak diperlukan latar belakang khusus untuk memulai.',
  },
  {
    question: 'Apakah saya perlu latar belakang tertentu untuk memulai?',
    answer: 'Tidak sama sekali. Kurikulum SynapEd dirancang mulai dari level pemula yang tidak mengasumsikan pengetahuan sebelumnya. Semua orang bisa belajar dari nol.',
  },
  {
    question: 'Bidang ilmu apa saja yang tersedia di SynapEd?',
    answer: 'SynapEd menyediakan berbagai bidang ilmu mulai dari Neuroscience, Teknologi, Data Science, Pemrograman, hingga bidang-bidang lainnya yang terus bertambah. Setiap materi disusun secara terstruktur dari dasar hingga mahir.',
  },
  {
    question: 'Berapa lama waktu yang dibutuhkan untuk menyelesaikan satu kursus?',
    answer: 'Tergantung pada kursus yang dipilih, rata-rata 2–6 minggu jika belajar 1–2 jam per hari. Semua kursus bersifat self-paced, sehingga Anda bisa mengatur waktu sesuai kenyamanan Anda sendiri.',
  },
  {
    question: 'Apakah ada sertifikat setelah menyelesaikan kursus?',
    answer: 'Ya, peserta yang menyelesaikan seluruh modul dan lulus evaluasi akan mendapatkan sertifikat digital dari SynapEd yang dapat dibagikan di LinkedIn atau portofolio Anda.',
  },
];

export const learningSteps = [
  { num: '01', title: 'Daftar', desc: 'Buat akun dan mulai akses seluruh kurikulum.', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
  { num: '02', title: 'Pilih Materi', desc: 'Jelajahi kurikulum dan pilih modul sesuai minat.', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { num: '03', title: 'Belajar', desc: 'Tonton video, modul PDF, dan selesaikan kuis.', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  { num: '04', title: 'Praktik', desc: 'Terapkan ilmu melalui studi kasus dan proyek nyata.', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { num: '05', title: 'Evaluasi', desc: 'Ikuti ujian akhir dan dapatkan sertifikat digital.', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
];

export const features = [
  { title: 'Kurikulum Terverifikasi', desc: 'Materi dikurasi oleh para ahli dan praktisi berpengalaman di bidangnya.' },
  { title: 'Video Berkualitas', desc: 'Video rekaman & animasi terstruktur yang sangat mudah dipahami.' },
  { title: 'Modul PDF Lengkap', desc: 'Ringkasan PDF yang dapat diunduh untuk mendukung belajar secara offline.' },
  { title: 'Studi Kasus Praktis', desc: 'Studi kasus nyata dan panduan praktik untuk melatih skill secara langsung.' },
  { title: 'Akses Fleksibel', desc: 'Responsif di laptop, tablet, atau smartphone. Belajar di mana saja.' },
  { title: 'Berbasis Riset', desc: 'Kurikulum disusun berdasarkan standar riset teknologi terbaru.' },
];
