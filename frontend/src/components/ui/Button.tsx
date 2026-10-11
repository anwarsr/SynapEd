import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 font-medium " +
  "transition-colors duration-200 ease-out-soft focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-paper";

const variants: Record<Variant, string> = {
  // Biru adalah identitas — jadi biru yang memimpin aksi utama.
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-ink text-paper hover:bg-ink-body",
  outline: "bg-white/10 text-white hover:bg-white/15",
  ghost: "text-ink-body hover:text-white",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
};

interface Props {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: Variant;
  size?: Size;
  className?: string;
  type?: "button" | "submit";
  "aria-label"?: string;
}

export default function Button({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...rest
}: Props) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes} {...rest}>
      {children}
    </button>
  );
}
