import { cn } from "@/lib/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Foto profil dengan cadangan inisial bila belum ada. */
export default function UserAvatar({
  name,
  photoURL,
  size = "md",
}: {
  name: string;
  photoURL: string | null;
  size?: "md" | "lg";
}) {
  const box = size === "lg" ? "w-20 h-20 text-xl" : "w-10 h-10 text-sm";

  return (
    <span
      className={cn(
        "rounded-full overflow-hidden bg-blue-50 border border-rule flex items-center justify-center shrink-0",
        box,
      )}
    >
      {photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoURL} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="t-numeral text-blue-700">{initials(name)}</span>
      )}
    </span>
  );
}
