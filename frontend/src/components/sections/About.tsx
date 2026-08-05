import Card from "@/components/ui/Card";
import Reveal from "@/components/ui/Reveal";
import SectionHeader from "@/components/ui/SectionHeader";

const cards = [
  {
    title: "Terstruktur",
    desc: "Kurikulum disusun secara terstruktur dan terukur sehingga memudahkan pemahaman bertahap.",
    iconPath:
      "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z",
  },
  {
    title: "Interaktif",
    desc: "Elemen interaktif dan kuis menjadikan pembelajaran lebih menarik dan efektif.",
    iconPath:
      "M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59",
  },
  {
    title: "Berbasis Riset",
    desc: "Seluruh materi divalidasi berdasarkan jurnal dan literatur ilmiah internasional terbaru.",
    iconPath:
      "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
  },
];

export default function About() {
  return (
    <section id="about" className="py-28 bg-paper">
      <div className="container-page">
        <SectionHeader
          chapter="01"
          label="Tentang"
          sub="SynapEd menghadirkan pembelajaran dari berbagai bidang ilmu secara sistematis dan terstruktur. Materi dirancang agar mudah dipahami oleh pelajar dan pemula tanpa memerlukan latar belakang khusus."
        >
          Platform pembelajaran modern <br />
          untuk <span className="mark">generasi digital</span>
        </SectionHeader>

        <div className="grid md:grid-cols-3 gap-5">
          {cards.map((card, i) => (
            // Deskripsi selalu tampil — versi sebelumnya menyembunyikannya
            // di balik hover, yang berarti hilang total di perangkat sentuh.
            <Reveal key={card.title} delay={i * 110}>
              <Card hover className="group p-8 h-full">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 ease-out-soft group-hover:-translate-y-1 group-hover:bg-blue-600">
                  <svg
                    className="w-6 h-6 text-blue-700 transition-colors duration-300 group-hover:text-white"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.iconPath} />
                  </svg>
                </div>
                <h3 className="t-h3 mb-3">{card.title}</h3>
                <p className="t-body text-sm">{card.desc}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
