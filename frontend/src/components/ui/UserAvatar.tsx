import { cn } from "@/lib/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const sizes = {
  sm: "w-9 h-9 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-20 h-20 text-xl",
} as const;

/** Foto profil dengan cadangan inisial bila belum ada. */
export default function UserAvatar({
  name,
  photoURL,
  size = "md",
  className,
}: {
  name: string;
  photoURL: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full overflow-hidden bg-black flex items-center justify-center shrink-0",
        sizes[size],
        className,
      )}
    >
      {photoURL ? (
        // Foto datang dari Firebase Storage dengan URL bertanda tangan yang
        // panjang; <img> biasa menghindarkan konfigurasi remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoURL} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="t-numeral text-white">{initials(name)}</span>
      )}
    </span>
  );
}
