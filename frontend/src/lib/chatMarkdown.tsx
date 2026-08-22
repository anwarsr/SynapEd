import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Parser markdown SANGAT terbatas untuk balasan Asisten SynapEd — cuma
 * **bold** dan [label](url), sesuai aturan format di chatPrompt.ts. Bukan
 * markdown umum: sengaja sempit supaya tidak ada permukaan render HTML
 * bebas dari teks yang dihasilkan model.
 */
const INLINE_PATTERN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Hanya path internal (satu "/" di depan) atau https:// yang boleh jadi tautan sungguhan. */
function isSafeHref(href: string): boolean {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  return href.startsWith("https://");
}

function renderLine(line: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(line))) {
    if (match.index > last) nodes.push(line.slice(last, match.index));

    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-${i}`} className="font-semibold">
          {match[1]}
        </strong>,
      );
    } else {
      const label = match[2];
      const href = match[3];
      if (isSafeHref(href)) {
        nodes.push(
          href.startsWith("/") ? (
            <Link key={`${keyPrefix}-${i}`} href={href} className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800">
              {label}
            </Link>
          ) : (
            <a
              key={`${keyPrefix}-${i}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
            >
              {label}
            </a>
          ),
        );
      } else {
        nodes.push(label);
      }
    }

    last = INLINE_PATTERN.lastIndex;
    i++;
  }

  if (last < line.length) nodes.push(line.slice(last));
  return nodes;
}

/** Merender teks balasan multi-baris dengan bold/tautan terbatas di atas. */
export function renderChatText(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, li) => (
    <span key={li}>
      {renderLine(line, String(li))}
      {li < lines.length - 1 && <br />}
    </span>
  ));
}

const OPTIONS_MARKER = /\n?\[\[options:\s*([^\]]+)\]\]\s*$/;

/**
 * Memisahkan baris penanda `[[options: A | B | C]]` di akhir balasan (lihat
 * chatPrompt.ts) dari teks yang ditampilkan, dan mengubahnya jadi daftar
 * pilihan yang bisa diklik.
 */
export function extractChatOptions(content: string): { text: string; options: string[] } {
  const match = content.match(OPTIONS_MARKER);
  if (!match) return { text: content, options: [] };

  const options = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  return { text: content.slice(0, match.index).trimEnd(), options };
}
