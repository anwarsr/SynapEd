"use client";
import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHeader from "@/components/ui/SectionHeader";
import { faqs } from "@/data/landing";
import { cn } from "@/lib/cn";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i);

  return (
    <section id="faq" className="relative py-28 bg-paper overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-6">
        <SectionHeader chapter="07" label="Pertanyaan">
          Pertanyaan yang <span className="text-blue-600">sering diajukan</span>
        </SectionHeader>

        <div className="flex flex-col gap-4 items-center">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;

            return (
              <Reveal key={i} delay={i * 90} className="relative w-full flex justify-center items-center py-1">
                {/* Maskot — muncul saat kartu terbuka */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[5%] lg:left-[10%] bottom-[-10px] z-30 pointer-events-none",
                    "transition-all duration-200 ease-out-soft hidden lg:block",
                    isOpen ? "opacity-100 translate-x-2" : "opacity-0 -translate-x-8",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/3.png" alt="" className="h-56 w-auto object-contain" />
                </div>

                <div
                  className={cn(
                    "relative z-20 w-full max-w-2xl transition-transform duration-200 ease-out-soft",
                    isOpen && "lg:translate-x-16",
                  )}
                >
                  {/* Gelembung percakapan — rounded-tl kecil membentuk "ekor" */}
                  <div
                    className={cn(
                      "bg-paper-card rounded-3xl rounded-tl-sm border transition-colors duration-200 ease-out-soft",
                      isOpen ? "border-blue-300 shadow-soft" : "border-rule",
                    )}
                  >
                    <button
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 p-6 md:p-8 text-left"
                    >
                      <div className="flex items-center gap-5">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "w-1 h-8 rounded-full transition-colors duration-200",
                            isOpen ? "bg-amber-500" : "bg-rule-strong",
                          )}
                        />
                        <span
                          className={cn(
                            "t-h3 text-base md:text-lg transition-colors duration-200",
                            isOpen && "text-blue-700",
                          )}
                        >
                          {faq.question}
                        </span>
                      </div>

                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-200",
                          isOpen ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600",
                        )}
                      >
                        <svg
                          className={cn("w-4 h-4 transition-transform duration-200", isOpen && "rotate-180")}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>

                    <div
                      className="overflow-hidden transition-all duration-200 ease-out-soft"
                      style={{ maxHeight: isOpen ? "320px" : "0px" }}
                    >
                      <div className="px-8 md:px-[4.5rem] pb-8 pt-1">
                        <p className="t-body text-sm border-t border-rule pt-5">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <p className="text-center text-ink-muted text-sm mt-12">
          Masih ada pertanyaan?{" "}
          <a href="#" className="text-blue-700 font-medium hover:underline underline-offset-4">
            Hubungi kami
          </a>
        </p>
      </div>
    </section>
  );
}
