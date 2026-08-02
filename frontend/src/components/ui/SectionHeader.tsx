import Reveal from "@/components/ui/Reveal";
import { cn } from "@/lib/cn";

interface Props {
  /** Nomor bab, mis. "01" */
  chapter: string;
  /** Label bab, mis. "TENTANG" */
  label: string;
  children: React.ReactNode;
  sub?: string;
  align?: "left" | "center";
  className?: string;
}

/** Kepala section bergaya buku teks: §01 — LABEL, judul serif,
 *  garis aksen biru pendek. Dibungkus Reveal supaya sapuan stabilo
 *  "digambar" dan garis aksennya tumbuh saat masuk layar. */
export default function SectionHeader({
  chapter,
  label,
  children,
  sub,
  align = "center",
  className,
}: Props) {
  const centered = align === "center";

  return (
    <Reveal
      className={cn(
        "mb-14",
        centered ? "flex flex-col items-center text-center" : "flex flex-col items-start text-left",
        className,
      )}
    >
      <p className="chapter-mark mb-5">
        <span>§{chapter}</span>
        <span aria-hidden="true" className="w-6 h-px bg-rule-strong" />
        <span>{label}</span>
      </p>

      <h2 className="t-h2 max-w-3xl">{children}</h2>

      <span className={cn("rule-accent mt-6", centered && "mx-auto")} aria-hidden="true" />

      {sub && <p className="t-body mt-6 max-w-2xl text-ink-muted">{sub}</p>}
    </Reveal>
  );
}
