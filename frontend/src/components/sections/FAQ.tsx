"use client";

import { useState } from "react";
import Reveal from "@/components/ui/Reveal";
import { faqs } from "@/data/landing";
import { cn } from "@/lib/cn";
import SectionTitle from "@/components/sections/SectionTitle";

/** Tipografi FAQ */
const QUESTION: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  letterSpacing: "-0.015em",
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  return (
    <section
      id="faq"
      className="relative py-28 bg-ivory overflow-hidden"
    >
      <div className="relative container-reading">
        {/* Heading */}
        <Reveal className="flex flex-col items-center text-center mb-14">
          <SectionTitle title="FAQ" />
        </Reveal>

        {/* FAQ Cards */}
        <div className="flex flex-col gap-4 items-center">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;

            return (
              <Reveal
                key={i}
                delay={i * 90}
                className="group relative w-full flex justify-center items-center py-1"
              >
                {/* Maskot */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute left-[5%] lg:left-[10%] bottom-[-10px] z-30 pointer-events-none",
                    "transition-all duration-200 ease-out-soft hidden lg:block",
                    "group-hover:opacity-100 group-hover:translate-x-2",
                    isOpen
                      ? "opacity-100 translate-x-2"
                      : "opacity-0 -translate-x-8"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/3.png"
                    alt=""
                    className="h-56 w-auto object-contain"
                  />
                </div>

                {/* Card */}
                <div
                  className={cn(
                    "relative z-20 w-full max-w-2xl",
                    "transition-transform duration-200 ease-out-soft",
                    "group-hover:lg:translate-x-16",
                    isOpen && "lg:translate-x-16"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-3xl rounded-tl-sm border",
                      "bg-paper transition-all duration-200 ease-out-soft",
                      isOpen
                        ? "border-blue-600 shadow-sm"
                        : "border-white/10 group-hover:border-blue-600/40"
                    )}
                  >
                    {/* Question Button */}
                    <button
                      onClick={() => toggle(i)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 p-6 md:p-8 text-left"
                    >
                      <div className="flex items-center gap-5">
                        {/* Indicator */}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "w-1 h-8 rounded-full transition-colors duration-200",
                            isOpen
                              ? "bg-blue-600"
                              : "bg-white/25 group-hover:bg-blue-600/50"
                          )}
                        />

                        {/* Question */}
                        <span
                          className="text-base md:text-lg text-white"
                          style={QUESTION}
                        >
                          {faq.question}
                        </span>
                      </div>

                      {/* Arrow */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex-shrink-0 w-9 h-9",
                          "flex items-center justify-center",
                          "rounded-full transition-all duration-200",
                          isOpen
                            ? "bg-blue-600 text-white"
                            : "bg-white/10 text-white group-hover:bg-blue-600 group-hover:text-white"
                        )}
                      >
                        <svg
                          className={cn(
                            "w-4 h-4 transition-transform duration-200",
                            isOpen && "rotate-180"
                          )}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </span>
                    </button>

                    {/* Answer */}
                    <div
                      className="overflow-hidden transition-all duration-200 ease-out-soft"
                      style={{
                        maxHeight: isOpen ? "320px" : "0px",
                      }}
                    >
                      <div className="px-8 md:px-[4.5rem] pb-8 pt-1">
                        <p
                          className={cn(
                            "text-sm text-white/70",
                            "leading-relaxed",
                            "border-t border-white/10",
                            "pt-5"
                          )}
                        >
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Contact */}
        <p className="text-center text-white/50 text-sm mt-12">
          Masih ada pertanyaan?{" "}
          <a
            href="#"
            className="text-white font-medium hover:underline underline-offset-4"
          >
            Hubungi kami
          </a>
        </p>
      </div>
    </section>
  );
}