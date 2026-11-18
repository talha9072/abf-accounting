/**
 * Minimal, dependency-free HTML handling for letter templates.
 *
 * Template HTML comes from the editor (staff) and company values come from
 * Companies House (outside data), so:
 *  - template HTML is reduced to an allow-list of formatting tags with NO attributes
 *    (the only exception: `class="indent-1|2|3"` on paragraphs, rebuilt from scratch);
 *  - every merged value is HTML-escaped before it goes in.
 */

const ALLOWED = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "hr"]);
const VOID = new Set(["br", "hr"]);
/** Tags the browser's editor produces that mean the same as an allowed one. */
const ALIASES: Record<string, string> = {
  div: "p", // contentEditable blocks
  strike: "s", // execCommand("strikeThrough") in Chromium
  del: "s",
};

/** Paragraph indent levels the editor can set. Printed/previewed with matching CSS. */
export const MAX_INDENT = 3;
const INDENT_CLASS = /^indent-([1-9])$/;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** "indent-2" from a raw attribute string, or null. Only the class token is read — nothing else is kept. */
function indentClass(attrs: string): string | null {
  const m = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
  if (!m) return null;
  for (const token of (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/)) {
    const level = INDENT_CLASS.exec(token);
    if (level && Number(level[1]) <= MAX_INDENT) return `indent-${level[1]}`;
  }
  return null;
}

export function sanitizeTemplateHtml(input: string): string {
  let html = (input ?? "").slice(0, 100_000);
  // Drop dangerous blocks with their contents.
  html = html.replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Swap allowed tags for placeholders (attributes are discarded), drop the rest.
  const kept: string[] = [];
  html = html.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)\b([^>]*)>/g, (_, close: string, name: string, attrs: string) => {
    let tag = name.toLowerCase();
    tag = ALIASES[tag] ?? tag;
    if (!ALLOWED.has(tag)) return "";
    if (VOID.has(tag)) return close ? "" : `\u0000${kept.push(`<${tag}>`) - 1}\u0000`;
    let open = `<${tag}>`;
    if (!close && tag === "p") {
      const indent = indentClass(attrs);
      if (indent) open = `<p class="${indent}">`;
    }
    return `\u0000${kept.push(close ? `</${tag}>` : open) - 1}\u0000`;
  });

  // Anything left that looks like markup is text now.
  html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)] ?? "");
  // Normalise &nbsp; and collapse empty paragraphs.
  html = html.replace(/&nbsp;/g, " ").replace(/<p( class="indent-\d")?>\s*(<br>)?\s*<\/p>/g, "");
  return html.trim();
}

/** Plain text → safe paragraph HTML (used for single-line fields). */
export function textToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br>");
}
