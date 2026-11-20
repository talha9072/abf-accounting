/**
 * Minimal, dependency-free HTML handling for letter templates.
 *
 * Template HTML comes from the editor (staff) and company values come from
 * Companies House (outside data), so:
 *  - template HTML is reduced to an allow-list of formatting tags, and attributes are dropped —
 *    except a few that are rebuilt from scratch after checking them:
 *      · `class` on paragraphs: indent-1…3 and one paragraph style (style-lead / -small / -note);
 *      · `href` on links: http(s), mailto: and tel: only;
 *      · `src` (https only), `alt` and `width` on images;
 *  - every merged value is HTML-escaped before it goes in.
 */

const ALLOWED = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "h2",
  "h3",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);
const VOID = new Set(["br", "hr", "img"]);
/** Tags the browser's editor produces that mean the same as an allowed one. */
const ALIASES: Record<string, string> = {
  div: "p", // contentEditable blocks
  strike: "s", // execCommand("strikeThrough") in Chromium
  del: "s",
  h1: "h2", // Format menu: Heading / Subheading only
  h4: "h3",
  h5: "h3",
  h6: "h3",
};

/** Paragraph indent levels the editor can set. Printed/previewed with matching CSS. */
export const MAX_INDENT = 3;
const INDENT_CLASS = /^indent-([1-9])$/;

/** Paragraph styles (editor "Styles" menu). Printed with the .letter-body CSS in globals.css. */
export const PARAGRAPH_STYLES = [
  { value: "", label: "Normal" },
  { value: "style-lead", label: "Lead (larger)" },
  { value: "style-small", label: "Small print" },
  { value: "style-note", label: "Highlight box" },
] as const;
const STYLE_CLASSES: ReadonlySet<string> = new Set(PARAGRAPH_STYLES.map((s) => s.value).filter(Boolean));

/** Largest image width on the letter, in letter pixels (the A4 page is drawn 560 px wide). */
export const MAX_IMAGE_WIDTH = 480;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** One attribute's value from a raw attribute string (quoted or not), entity-decoded for checking. */
function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(attrs);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3] ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/** A link target the letter may carry: web, email or phone. Anything else (javascript:, data: …) → null. */
export function safeHref(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 500 || /[\s<>"'`]/.test(v)) return null;
  // Replace codes may sit inside a link (…?ref=##REFERENCE#); they are escaped when merged.
  // Web links need a real host name ("https://javascript:alert(1)" is not one).
  if (/^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?([/?#]|$)/i.test(v)) return v;
  if (/^mailto:[^@\s:/]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v) || /^tel:\+?[0-9 ()-]{5,20}$/i.test(v)) return v;
  return null;
}

/** Images must come from a public https address (no data:, http: or relative paths). */
export function safeImageSrc(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 1000 || /[\s<>"'`]/.test(v)) return null;
  return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?\/\S*$/i.test(v) ? v : null;
}

/** class="…" on a paragraph: an allowed indent level and/or one style. Only those tokens are kept. */
function paragraphClass(attrs: string): string | null {
  const tokens = (attr(attrs, "class") ?? "").split(/\s+/);
  let indent: string | null = null;
  let style: string | null = null;
  for (const token of tokens) {
    const level = INDENT_CLASS.exec(token);
    if (level && Number(level[1]) <= MAX_INDENT) indent = `indent-${level[1]}`;
    else if (STYLE_CLASSES.has(token)) style = token;
  }
  const out = [indent, style].filter(Boolean).join(" ");
  return out || null;
}

function openTag(tag: string, attrs: string): string | null {
  if (tag === "p") {
    const cls = paragraphClass(attrs);
    return cls ? `<p class="${cls}">` : "<p>";
  }
  if (tag === "a") {
    const href = safeHref(attr(attrs, "href"));
    return href ? `<a href="${escapeHtml(href)}">` : null;
  }
  if (tag === "img") {
    const src = safeImageSrc(attr(attrs, "src"));
    if (!src) return null;
    const alt = (attr(attrs, "alt") ?? "").slice(0, 200);
    const width = Math.floor(Number(attr(attrs, "width")));
    const w = Number.isFinite(width) && width >= 16 && width <= MAX_IMAGE_WIDTH ? ` width="${width}"` : "";
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${w}>`;
  }
  return `<${tag}>`;
}

export function sanitizeTemplateHtml(input: string): string {
  let html = (input ?? "").slice(0, 100_000);
  // Drop dangerous blocks with their contents.
  html = html.replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Swap allowed tags for placeholders (attributes rebuilt or discarded), drop the rest.
  // A link with a bad href is dropped with its closing tag (its text stays).
  const kept: string[] = [];
  const links: boolean[] = [];
  html = html.replace(/<\s*(\/?)\s*([a-zA-Z0-9]+)\b([^>]*)>/g, (_, close: string, name: string, attrs: string) => {
    let tag = name.toLowerCase();
    tag = ALIASES[tag] ?? tag;
    if (!ALLOWED.has(tag)) return "";
    if (VOID.has(tag)) {
      if (close) return "";
      const open = openTag(tag, attrs);
      return open ? `\u0000${kept.push(open) - 1}\u0000` : "";
    }
    if (close) {
      if (tag === "a" && !(links.pop() ?? false)) return "";
      return `\u0000${kept.push(`</${tag}>`) - 1}\u0000`;
    }
    const open = openTag(tag, attrs);
    if (tag === "a") links.push(open !== null);
    return open ? `\u0000${kept.push(open) - 1}\u0000` : "";
  });

  // Anything left that looks like markup is text now.
  html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)] ?? "");
  // Normalise &nbsp; and collapse empty paragraphs and headings.
  html = html.replace(/&nbsp;/g, " ").replace(/<(p|h2|h3)( class="[^"]*")?>\s*(<br>)?\s*<\/\1>/g, "");
  return html.trim();
}

/** Plain text → safe paragraph HTML (used for single-line fields). */
export function textToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br>");
}
