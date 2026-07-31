<section id="hero" class="relative min-h-screen flex items-center bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600 pt-20 overflow-hidden">

    <div class="absolute inset-0 pointer-events-none">
        <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400 rounded-full opacity-20 blur-[120px]"></div>
        <div class="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-500 rounded-full opacity-20 blur-[100px]"></div>

        <div class="absolute bottom-0 left-0 right-0 h-32 bg-blue-900/30" style="clip-path: ellipse(80% 100% at 50% 100%);"></div>
    </div>

    <div class="relative max-w-7xl mx-auto px-6 py-12 w-full">
        <div class="grid lg:grid-cols-2 gap-12 items-center">

            <div class="flex flex-col gap-6 z-10">
                <div class="inline-flex items-center gap-2 px-1 py-2 w-fit">
                    <span class="text-white text-sm font-poppins tracking-wide">Belajar Lebih Seru dan Menarik di SynapEd</span>
                </div>

                <h1 class="text-5xl lg:text-7xl font-poppins font-semibold leading-[1.1] text-white">
                    Platform Terbaik <br>
                    <span class="text-blue-500">Kuasai Ilmu Apapun</span>
                </h1>

                <p class="text-lg text-white font-poppins leading-relaxed max-w-lg">
                    Akses ratusan materi berkualitas dari berbagai bidang ilmu. Didesain untuk pelajar, mahasiswa, dan profesional di semua bidang.
                </p>

                <div class="flex flex-wrap gap-4 mt-4">
                    <a href="#" class="px-8 py-4 bg-white text-blue-900 hover:bg-blue-50 font-bold rounded-xl transition-all shadow-xl">
                        Mulai Belajar Sekarang
                    </a>
                    <a href="#courses" class="px-8 py-4 bg-transparent border-2 border-white/30 hover:border-white text-white font-bold rounded-xl transition-all">
                        Lihat Kurikulum
                    </a>
                </div>
            </div>

            <div class="relative flex justify-center items-center h-[500px] group">
                <div class="absolute w-[80%] aspect-square bg-blue-500 rounded-full opacity-10 blur-3xl"></div>

                <div class="relative z-10 w-full max-w-md h-full flex items-center justify-center">

                    <input type="radio" name="gallery" id="pic1" class="hidden peer/p1" checked>
                    <input type="radio" name="gallery" id="pic2" class="hidden peer/p2">
                    <input type="radio" name="gallery" id="pic3" class="hidden peer/p3">

                    <label for="pic2" class="absolute inset-0 cursor-pointer transition-all duration-700 ease-out transform
                        peer-checked/p1:z-30 peer-checked/p1:translate-x-0 peer-checked/p1:rotate-0 peer-checked/p1:opacity-100
                        peer-checked/p2:z-10 peer-checked/p2:translate-x-0 peer-checked/p2:opacity-0
                        peer-checked/p3:z-10 peer-checked/p3:translate-x-0 peer-checked/p3:opacity-0
                        group-hover:peer-checked/p1:translate-x-12 group-hover:peer-checked/p1:rotate-6 group-hover:peer-checked/p1:z-20">
                        <div class="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border-[1px] border-white/30">
                            <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80" class="w-full h-full object-cover" alt="Student Learning">
                        </div>
                    </label>

                    <label for="pic3" class="absolute inset-0 cursor-pointer transition-all duration-700 ease-out transform opacity-0
                        peer-checked/p2:z-30 peer-checked/p2:translate-x-0 peer-checked/p2:rotate-0 peer-checked/p2:opacity-100
                        group-hover:peer-checked/p1:opacity-100 group-hover:peer-checked/p1:-translate-x-10 group-hover:peer-checked/p1:-rotate-6
                        group-hover:peer-checked/p2:translate-x-12 group-hover:peer-checked/p2:rotate-6 group-hover:peer-checked/p2:z-20">
                        <div class="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border-[1px] border-white/30">
                            <img src="https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80" class="w-full h-full object-cover" alt="Research Lab">
                        </div>
                    </label>

                    <label for="pic1" class="absolute inset-0 cursor-pointer transition-all duration-700 ease-out transform opacity-0
                        peer-checked/p3:z-30 peer-checked/p3:translate-x-0 peer-checked/p3:rotate-0 peer-checked/p3:opacity-100
                        group-hover:peer-checked/p2:opacity-100 group-hover:peer-checked/p2:-translate-x-10 group-hover:peer-checked/p2:-rotate-6
                        group-hover:peer-checked/p3:translate-x-12 group-hover:peer-checked/p3:rotate-6 group-hover:peer-checked/p3:z-20">
                        <div class="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border-[1px] border-white/30">
                            <img src="https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&q=80" class="w-full h-full object-cover" alt="Technology and Learning">
                        </div>
                    </label>

                </div>
            </div>

        </div>
    </div>
</section>
