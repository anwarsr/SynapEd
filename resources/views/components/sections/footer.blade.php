<footer class="relative py-16 overflow-hidden" style="background: #050A14; border-top: 1px solid rgba(255,255,255,0.1);">
    <div class="max-w-7xl mx-auto px-6">

        <div class="grid md:grid-cols-4 gap-10 mb-12">

            <div class="md:col-span-2">
                <div class="flex items-center gap-3 mb-4">
                    <div class="h-10 w-auto flex items-center"> <img src="{{ asset('images/logotextwhite.png') }}"
                            alt="SynapEd Logo"
                            class="h-12 w-auto object-contain transform scale-150 origin-left">
                    </div>
                </div>
                <p class="text-slate-400 text-sm leading-relaxed max-w-xs mb-6">
                    Platform pembelajaran online terlengkap yang terbuka untuk semua kalangan. Pelajari berbagai bidang ilmu dan kembangkan potensimu bersama <strong>SynapEd</strong>.
                </p>

                <div class="flex items-center gap-3">
                    @foreach([
                        ['label' => 'GitHub', 'path' => 'M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z'],
                        ['label' => 'YouTube', 'path' => 'M21.582 7.186a2.506 2.506 0 00-1.768-1.768C18.254 5 12 5 12 5s-6.254 0-7.814.418A2.506 2.506 0 002.418 7.186C2 8.747 2 12 2 12s0 3.253.418 4.814a2.506 2.506 0 001.768 1.768C5.746 19 12 19 12 19s6.254 0 7.814-.418a2.506 2.506 0 001.768-1.768C22 15.253 22 12 22 12s0-3.253-.418-4.814zM10 15V9l5.196 3L10 15z'],
                        ['label' => 'LinkedIn', 'path' => 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z'],
                    ] as $social)
                    <a href="#" class="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 hover:border-blue-500 transition-all duration-300" aria-label="{{ $social['label'] }}">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="{{ $social['path'] }}" />
                        </svg>
                    </a>
                    @endforeach
                </div>
            </div>

            <div>
                <h4 class="text-white font-semibold text-sm mb-5 uppercase tracking-wider">Platform</h4>
                <ul class="flex flex-col gap-3">
                    @foreach(['Tentang Kami', 'Kurikulum', 'Sertifikasi', 'Blog', 'FAQ'] as $link)
                    <li><a href="#" class="text-slate-400 hover:text-[#0056D2] text-sm transition-colors duration-200">{{ $link }}</a></li>
                    @endforeach
                </ul>
            </div>

            <div>
                <h4 class="text-white font-semibold text-sm mb-5 uppercase tracking-wider">Materi</h4>
                <ul class="flex flex-col gap-3">
                    @foreach(['Neuroscience', 'Teknologi & Data', 'Pemrograman', 'Sains', 'Lihat Semua →'] as $link)
                    <li><a href="#" class="text-slate-400 hover:text-[#0056D2] text-sm transition-colors duration-200">{{ $link }}</a></li>
                    @endforeach
                </ul>
            </div>
        </div>

        <div class="h-px mb-8" style="background: rgba(255,255,255,0.08);"></div>
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500 uppercase tracking-tight">
            <span>© {{ date('Y') }} SynapEd. Learn Anything, Anytime.</span>
            <div class="flex items-center gap-6">
                <a href="#" class="hover:text-[#0056D2] transition-colors">Kebijakan Privasi</a>
                <a href="#" class="hover:text-[#0056D2] transition-colors">Syarat Penggunaan</a>
            </div>
        </div>
    </div>
</footer>
