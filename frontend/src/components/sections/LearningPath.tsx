"use client";
import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHeader from "@/components/ui/SectionHeader";
import { learningSteps } from "@/data/landing";
import { cn } from "@/lib/cn";

export default function LearningPath() {
  const [active, setActive] = useState(0);

  return (
    <section id="learning-path" className="py-28 bg-paper-alt border-y border-rule overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader chapter="05" label="Alur Belajar">
          Alur <span className="text-blue-600">pembelajaran</span>
        </SectionHeader>

        <div className="grid lg:grid-cols-5 gap-4">
          {learningSteps.map((step, i) => {
            const isActive = active === i;

            return (
              <Reveal key={i} delay={i * 100} className="h-full">
              <button
                onClick={() => setActive(i)}
                aria-pressed={isActive}
                className={cn(
                  "relative overflow-hidden text-left rounded-2xl p-6 border w-full h-full",
                  "transition-all duration-300 ease-out-soft hover:-translate-y-1.5",
                  isActive
                    ? "bg-navy border-navy shadow-lift"
                    : "bg-paper-card border-rule hover:border-rule-strong hover:shadow-soft",
                )}
              >
                {/* Numeral bab raksasa — motif buku teks terkuat di halaman */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "t-numeral-ghost absolute -top-3 right-3 text-7xl select-none",
                    isActive ? "text-white/10" : "text-rule",
                  )}
                >
                  {step.num}
                </span>

                {/* Penanda aktif */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "block w-8 h-px mb-6 transition-colors duration-200",
                    isActive ? "bg-amber-500" : "bg-rule-strong",
                  )}
                />

                <svg
                  className={cn("w-5 h-5 mb-4", isActive ? "text-blue-300" : "text-blue-600")}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                </svg>

                <h3 className={cn("t-h3 text-lg mb-2 relative", isActive && "text-paper")}>
                  {step.title}
                </h3>
                <p className={cn("t-body text-sm relative", isActive && "text-blue-100")}>
                  {step.desc}
                </p>
              </button>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
