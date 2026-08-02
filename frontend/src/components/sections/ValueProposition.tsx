import Card from "@/components/ui/Card";
import Reveal from "@/components/ui/Reveal";
import SectionHeader from "@/components/ui/SectionHeader";
import { cn } from "@/lib/cn";

export default function ValueProposition() {
  const cards = [
    {
      title: "Sains & Teknologi",
      desc: "Eksplorasi berbagai cabang ilmu sains dan teknologi terkini secara mendalam dan terstruktur.",
      iconPath:
        "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    },
    {
      title: "Neuroscience & EEG",
      desc: "Kuasai cara kerja otak dan teknologi perekaman sinyal otak secara mendalam.",
      iconPath:
        "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
    },
    {
      title: "Pemrograman & Data",
      desc: "Praktik menggunakan Python dan tools modern untuk analisis dan visualisasi data.",
      iconPath:
        "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    },
    {
      title: "Riset & Inovasi",
      desc: "Pelajari metodologi riset dan inovasi terbaru di berbagai bidang keilmuan.",
      iconPath:
        "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    },
  ];

  return (
    <section id="value" className="py-28 bg-paper-alt border-y border-rule">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader chapter="02" label="Kurikulum">
          Materi pembelajaran <span className="text-blue-600">pilihan terbaik</span>
        </SectionHeader>

        {/* Selang-seling navy — memberi biru bidang nyata, bukan hanya aksen.
            Aman sekarang karena layer override text-white di globals sudah dihapus. */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {cards.map((card, i) => {
            const dark = i % 2 === 1;

            return (
              <Reveal key={card.title} delay={i * 110} className="h-full">
              <Card
                hover
                tone={dark ? "navy" : "paper"}
                className="group p-8 flex flex-col min-h-[260px] h-full transition-transform duration-300 ease-out-soft hover:-translate-y-1.5"
              >
                <div className="flex items-start justify-between mb-8">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      dark ? "bg-white/10" : "bg-blue-100",
                    )}
                  >
                    <svg
                      className={cn("w-6 h-6", dark ? "text-blue-300" : "text-blue-700")}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={card.iconPath} />
                    </svg>
                  </div>
                  <span
                    className={cn(
                      "t-numeral-ghost text-3xl",
                      dark ? "text-white/25" : "text-rule-strong",
                    )}
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <div className="mt-auto">
                  <h3 className={cn("t-h3 mb-3", dark && "text-paper")}>{card.title}</h3>
                  <p className={cn("t-body text-sm", dark && "text-blue-100")}>{card.desc}</p>
                </div>
              </Card>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
