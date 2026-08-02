import { cn } from "@/lib/cn";

type Tone = "paper" | "navy";

const tones: Record<Tone, string> = {
  paper: "bg-paper-card border-rule",
  navy: "bg-navy border-navy",
};

interface Props {
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  /** Angkat halus saat hover — untuk kartu yang bisa diklik. */
  hover?: boolean;
}

/** Kartu putih murni di atas kertas warm-white.
 *  Struktur datang dari garis 1px, bukan dari bayangan.
 *  Varian `navy` dipakai selang-seling agar biru punya bidang nyata. */
export default function Card({ children, className, tone = "paper", hover = false }: Props) {
  return (
    <div
      className={cn(
        "border rounded-2xl",
        tones[tone],
        hover &&
          "transition-[border-color,box-shadow] duration-200 ease-out-soft hover:shadow-soft " +
            (tone === "navy" ? "hover:border-blue-500" : "hover:border-rule-strong"),
        className,
      )}
    >
      {children}
    </div>
  );
}
