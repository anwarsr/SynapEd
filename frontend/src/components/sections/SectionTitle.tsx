import { cn } from "@/lib/cn";

/**
 * Judul section: satu kata/frasa BESAR di tengah (huruf kapital, tebal).
 * Ukuran huruf dihitung dari panjang judul supaya judul panjang ("LEARNING PATH") tetap muat selebar layar tanpa terpotong,
 * sedangkan judul pendek dibatasi 11rem.
 */
export default function SectionTitle({
  title,
  as: Tag = "h2",
  className,
}: {
  title: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const vw = (88 / (title.length * 0.64)).toFixed(2);

  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <Tag
        className="max-w-full font-extrabold uppercase text-blue-600"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: `min(${vw}vw, 11rem)`,
          lineHeight: 0.95,
          letterSpacing: "-0.04em",
        }}
      >
        {title}
      </Tag>
    </div>
  );
}
