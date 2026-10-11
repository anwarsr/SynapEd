import { cn } from "@/lib/cn";

type Tone = "neutral" | "blue" | "amber" | "rust";

const tones: Record<Tone, string> = {
  neutral: "bg-paper-alt text-ink-muted",
  blue: "bg-blue-50 text-blue-700",
  // Tema gelap: tint transparan + teks terang, bukan kotak krem/oranye pucat.
  amber: "bg-amber-500/15 text-warn-text",
  rust: "bg-[#E0795A]/15 text-error-text",
};

interface Props {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export default function Tag({ children, tone = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
