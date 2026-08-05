import { partners } from "@/data/landing";

export default function Partners() {
  const allPartners = [...partners, ...partners];

  return (
    <section id="partners" className="py-16 bg-paper border-t border-rule overflow-hidden">
      <div className="container-page">
        <p className="t-label text-ink-faint text-center mb-8">Dipercaya Oleh</p>

        <div className="relative">
          {/* Tepi memudar ke warna kertas */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-24 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, var(--color-paper), transparent)" }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 w-24 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to left, var(--color-paper), transparent)" }}
          />

          <div className="overflow-hidden">
            <div className="marquee-track flex gap-4 w-max">
              {allPartners.map((partner, i) => (
                <div
                  key={i}
                  className="bg-paper-card border border-rule rounded-2xl px-5 py-3.5 flex items-center gap-3 select-none whitespace-nowrap flex-shrink-0"
                >
                  <span className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {partner.abbr[0]}
                  </span>
                  <span className="text-sm text-ink-body">{partner.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
