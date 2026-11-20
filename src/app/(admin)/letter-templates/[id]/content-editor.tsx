"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  faBars,
  faBold,
  faChevronDown,
  faCircleInfo,
  faCircleQuestion,
  faCode,
  faCompress,
  faExpand,
  faGripLines,
  faImage,
  faIndent,
  faItalic,
  faLink,
  faLinkSlash,
  faListOl,
  faListUl,
  faLock,
  faOutdent,
  faQuoteLeft,
  faRotateLeft,
  faRotateRight,
  faStrikethrough,
  faTable,
  faTextSlash,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FitLetter } from "@/components/admin/fit-letter";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Note } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { escapeHtml, MAX_IMAGE_WIDTH, MAX_INDENT, PARAGRAPH_STYLES, safeHref, safeImageSrc, sanitizeTemplateHtml } from "@/lib/letters/html";
import { mergeCodes, mergeGreeting } from "@/lib/letters/merge";
import type { RenderedLetter } from "@/lib/letters/data";
import { saveContentAction } from "@/lib/templates/actions";
import type { PreviewContext } from "@/lib/templates/preview";
import { codeExample, REPLACE_CODES } from "@/lib/letters/codes";
import { useTemplateEditor } from "./template-workspace";
import { cn } from "@/lib/cn";

/** Special characters (toolbar Ω). */
const SPECIAL_CHARS = ["£", "€", "$", "–", "—", "‘", "’", "“", "”", "…", "•", "·", "©", "®", "™", "°", "½", "¼", "¾", "×", "÷", "±", "✓", "→", "§", "¶"];
/** Format menu → block tag. */
const FORMATS = [
  { tag: "p", label: "Paragraph" },
  { tag: "h2", label: "Heading" },
  { tag: "h3", label: "Subheading" },
] as const;
const IMAGE_SIZES = [
  { width: 120, label: "Small" },
  { width: 240, label: "Medium" },
  { width: MAX_IMAGE_WIDTH, label: "Full width" },
];

/** Codes that make sense inside the letter text (head/footer/QR are drawn by the layout). */
const MENU_CODES = REPLACE_CODES.filter((c) => c.inBody);
const BODY_CODES = MENU_CODES.map((c) => c.code);

type TemplateProps = {
  id: string;
  name: string;
  contentHtml: string;
  offer: string;
  cta: string;
  greeting: string;
  signOff: string;
  signatory: string;
  readOnly: boolean;
};

export function ContentEditor({ template, preview }: { template: TemplateProps; preview: PreviewContext }) {
  const router = useRouter();
  const toast = useToast();
  const { markDirty, registerSave } = useTemplateEditor();
  const editorRef = useRef<HTMLDivElement>(null);
  const ro = template.readOnly;

  const [name, setName] = useState(template.name);
  const [html, setHtml] = useState(template.contentHtml);
  const [offer, setOffer] = useState(template.offer);
  const [cta, setCta] = useState(template.cta);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  // Fill the editable area once (React must not re-render it while typing).
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = template.contentHtml;
  }, [template.contentHtml]);

  // Latest values for the registered save function.
  const [source, setSource] = useState<string | null>(null); // HTML source view (toolbar </>)
  const latest = useRef({ name, html, offer, cta, source });
  useEffect(() => {
    latest.current = { name, html, offer, cta, source };
  }, [name, html, offer, cta, source]);

  useEffect(() => {
    if (ro) return registerSave(null);
    registerSave(async () => {
      const v = latest.current;
      // Saving from the HTML source view saves what is in the source box (sanitised on the server).
      const r = await saveContentAction({ id: template.id, name: v.name, contentHtml: v.source ?? v.html, offer: v.offer, cta: v.cta });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast({ message: r.message });
        return false;
      }
      setErrors({});
      toast({ message: r.message });
      router.refresh();
      return true;
    });
    return () => registerSave(null);
  }, [registerSave, ro, router, template.id, toast]);

  const touch = () => markDirty(true);
  const syncHtml = () => {
    setHtml(editorRef.current?.innerHTML ?? "");
    touch();
  };

  const [fullscreen, setFullscreen] = useState(false);
  const locked = ro || source !== null;

  // Pop-ups with text fields take focus away from the letter: remember where the cursor was.
  const savedRange = useRef<Range | null>(null);
  const saveSelection = () => {
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (sel?.rangeCount && editor?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (command: string, value?: string) => {
    if (locked) return;
    editorRef.current?.focus();
    // execCommand is deprecated but still the simplest dependency-free rich-text option here.
    // The result is always re-sanitised on the server before it's stored or printed.
    document.execCommand(command, false, value);
    syncHtml();
  };
  /** Insert HTML where the cursor was before a pop-up opened. */
  const insertHtml = (markup: string) => {
    if (locked) return;
    restoreSelection();
    document.execCommand("insertHTML", false, markup);
    syncHtml();
  };

  /** Block elements (top level of the editor) the selection touches. */
  const selectedBlocks = (match: string) => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel?.rangeCount || !editor.contains(sel.anchorNode)) return [];
    const range = sel.getRangeAt(0);
    return Array.from(editor.children).filter((el): el is HTMLElement => el instanceof HTMLElement && el.matches(match) && range.intersectsNode(el));
  };

  /** Styles menu: one paragraph style per paragraph (indent is kept). */
  const applyStyle = (style: string) => {
    if (locked) return;
    restoreSelection();
    let blocks = selectedBlocks("p, div");
    if (!blocks.length) {
      document.execCommand("formatBlock", false, "p");
      blocks = selectedBlocks("p, div");
    }
    for (const el of blocks) {
      const keep = el.className.split(/\s+/).filter((c) => /^indent-\d$/.test(c));
      const next = [...keep, ...(style ? [style] : [])].join(" ");
      if (next) el.className = next;
      else el.removeAttribute("class");
    }
    syncHtml();
  };

  const toggleSource = () => {
    if (ro) return;
    if (source === null) {
      setSource(sanitizeTemplateHtml(editorRef.current?.innerHTML ?? "").replace(/(<\/(p|h2|h3|ul|ol|blockquote|table)>|<hr>)/g, "$1\n"));
      return;
    }
    // Back to the visual editor: only what the letter may contain survives.
    const clean = sanitizeTemplateHtml(source);
    if (editorRef.current) editorRef.current.innerHTML = clean;
    setSource(null);
    setHtml(clean);
    touch();
  };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
    };
  }, [fullscreen]);
  const insertCode = (code: string) => exec("insertText", code);

  /**
   * Indent / outdent. execCommand("indent") wraps paragraphs in <blockquote style="margin…">, and the
   * sanitiser drops the style, so it would print as a quote. Instead: list items nest (plain <ul>/<ol>,
   * which the sanitiser keeps) and paragraphs get an allow-listed `indent-1…3` class.
   */
  const indent = (delta: 1 | -1) => {
    const editor = editorRef.current;
    if (locked || !editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel?.rangeCount || !editor.contains(sel.anchorNode)) return;

    const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
    const li = anchor?.closest("li");
    if (li && editor.contains(li)) {
      exec(delta > 0 ? "indent" : "outdent");
      return;
    }

    const blocksInRange = () => {
      const range = sel.getRangeAt(0);
      return Array.from(editor.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.matches("p, div") && range.intersectsNode(el),
      );
    };
    let blocks = blocksInRange();
    // Text typed straight into the editor has no block yet — give it a paragraph first.
    if (!blocks.length) {
      document.execCommand("formatBlock", false, "p");
      blocks = blocksInRange();
    }
    for (const el of blocks) {
      const current = Number(/(?:^|\s)indent-(\d)(?:\s|$)/.exec(el.className)?.[1] ?? 0);
      const next = Math.max(0, Math.min(MAX_INDENT, current + delta));
      if (next) el.className = `indent-${next}`;
      else el.removeAttribute("class");
    }
    syncHtml();
  };

  /** Live preview with a real company — same sanitise + merge as printing. */
  const letter: RenderedLetter = useMemo(() => {
    const values = { ...preview.values, OFFER: offer };
    return {
      ...preview.recipient,
      bodyHtml: mergeCodes(sanitizeTemplateHtml(html), values),
      greeting: mergeGreeting(template.greeting, values),
      signOff: template.signOff,
      signatory: template.signatory || null,
      offer: offer || null,
      cta: cta || null,
      qrUrl: null,
      qrSvg: preview.qrSvg,
      business: preview.business,
    };
  }, [html, offer, cta, preview, template.greeting, template.signOff, template.signatory]);

  const unknownCodes = useMemo(() => {
    const known = new Set([...BODY_CODES, "##LETTER_HEAD#", "##LETTER_FOOTER#", "##QR_CODE#"]);
    return [...new Set(html.match(/##[A-Z_]+#/g) ?? [])].filter((c) => !known.has(c));
  }, [html]);

  return (
    <div className="grid items-start gap-4 min-[1680px]:grid-cols-[minmax(0,664fr)_452fr]">
      <div className="flex min-w-0 flex-col gap-3.5">
        {ro ? (
          <Note tone="neutral" icon={faLock}>
            This template is archived and read-only. Set it back to Active or Draft in Settings to edit it.
          </Note>
        ) : null}

        <div className="flex items-center gap-2">
          <label htmlFor="tpl-internal-name" className="text-[12px] font-medium leading-4 text-ink">
            Internal template name
          </label>
          <StatusBadge tone="neutral" size="sm">
            Required
          </StatusBadge>
        </div>
        <Input
          id="tpl-internal-name"
          value={name}
          maxLength={120}
          required
          disabled={ro}
          aria-invalid={errors.name ? true : undefined}
          onChange={(e) => (setName(e.target.value), touch())}
          className="h-10 rounded-[9px] px-3"
        />
        {errors.name ? <p className="-mt-2 text-[12px] text-danger">{errors.name[0]}</p> : null}

        <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] font-medium leading-4 text-ink">
          Letter content{" "}
          <span className="text-[10px] font-normal text-muted">
            Replace codes fill automatically · greeting, offer box, sign-off, letterhead and footer are added for you
          </span>
        </p>

        {fullscreen ? <div aria-hidden className="fixed inset-0 z-40 bg-ink/40" onClick={() => setFullscreen(false)} /> : null}
        <div
          className={cn(
            "overflow-hidden rounded-[10px] border border-line bg-white",
            fullscreen && "fixed inset-4 z-50 flex flex-col shadow-[0_24px_64px_rgba(9,36,45,0.25)] sm:inset-8",
          )}
          role={fullscreen ? "dialog" : undefined}
          aria-modal={fullscreen || undefined}
          aria-label={fullscreen ? "Letter content — full screen" : undefined}
        >
          {/* Toolbar (Figma "Letter Templates / Content": two rows, like eFiling's editor) */}
          <div role="toolbar" aria-label="Formatting" className="flex flex-col gap-1 border-b border-line bg-canvas px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-1">
              <Tool icon={faRotateLeft} label="Undo" onClick={() => exec("undo")} disabled={locked} />
              <Tool icon={faRotateRight} label="Redo" onClick={() => exec("redo")} disabled={locked} />
              <Sep />
              <Tool icon={faBold} label="Bold" onClick={() => exec("bold")} disabled={locked} />
              <Tool icon={faItalic} label="Italic" onClick={() => exec("italic")} disabled={locked} />
              <Tool icon={faStrikethrough} label="Strikethrough" onClick={() => exec("strikeThrough")} disabled={locked} />
              <Tool icon={faTextSlash} label="Clear formatting" onClick={() => exec("removeFormat")} disabled={locked} />
              <Sep />
              <Tool icon={faListOl} label="Numbered list" onClick={() => exec("insertOrderedList")} disabled={locked} />
              <Tool icon={faListUl} label="Bullet list" onClick={() => exec("insertUnorderedList")} disabled={locked} />
              <Tool icon={faOutdent} label="Outdent" onClick={() => indent(-1)} disabled={locked} />
              <Tool icon={faIndent} label="Indent" onClick={() => indent(1)} disabled={locked} />
              <Sep />
              <Tool icon={faQuoteLeft} label="Quote" onClick={() => exec("formatBlock", "blockquote")} disabled={locked} />
              <Sep />
              <LinkTool disabled={locked} onOpen={saveSelection} onInsert={insertHtml} onLink={(url) => (restoreSelection(), exec("createLink", url))} onUnlink={() => (restoreSelection(), exec("unlink"))} />
              <ImageTool disabled={locked} onOpen={saveSelection} onInsert={insertHtml} />
              <TableTool disabled={locked} onOpen={saveSelection} onInsert={insertHtml} />
              <Tool icon={faGripLines} label="Horizontal line" onClick={() => exec("insertHorizontalRule")} disabled={locked} />
              <Popover
                align="start"
                fixed
                panelClassName="w-[244px]"
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    title="Special character"
                    aria-label="Special character"
                    aria-expanded={open}
                    disabled={locked}
                    onMouseDown={(e) => (e.preventDefault(), saveSelection())}
                    onClick={toggle}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-[14px] font-semibold text-ink transition-colors hover:bg-white disabled:opacity-40"
                  >
                    Ω
                  </button>
                )}
              >
                {(close) => (
                  <div className="grid grid-cols-6 gap-1" role="group" aria-label="Special characters">
                    {SPECIAL_CHARS.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => (insertHtml(escapeHtml(ch)), close())}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-line text-[14px] text-ink hover:border-brand hover:bg-mint"
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                )}
              </Popover>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <MenuButton label="Styles" disabled={locked} onOpen={saveSelection}>
                {(close) =>
                  PARAGRAPH_STYLES.map((s) => (
                    <MenuOption key={s.value || "normal"} onPick={() => (applyStyle(s.value), close())}>
                      {s.label}
                    </MenuOption>
                  ))
                }
              </MenuButton>
              <MenuButton label="Format" disabled={locked} onOpen={saveSelection}>
                {(close) =>
                  FORMATS.map((f) => (
                    <MenuOption key={f.tag} onPick={() => (restoreSelection(), exec("formatBlock", `<${f.tag}>`), close())}>
                      <span className={cn(f.tag === "h2" && "text-[15px] font-bold", f.tag === "h3" && "text-[14px] font-bold")}>{f.label}</span>
                    </MenuOption>
                  ))
                }
              </MenuButton>
              <Sep />
              <Tool icon={fullscreen ? faCompress : faExpand} label={fullscreen ? "Exit full screen" : "Full screen"} onClick={() => setFullscreen((v) => !v)} />
              <Tool icon={faCode} label={source === null ? "HTML source" : "Back to the editor"} onClick={toggleSource} disabled={ro} pressed={source !== null} />
              <Popover
                align="start"
                fixed
                panelClassName="w-[320px]"
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    title="Help"
                    aria-label="Help"
                    aria-expanded={open}
                    onClick={toggle}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-white"
                  >
                    <Icon icon={faCircleQuestion} size={12} />
                  </button>
                )}
              >
                {() => (
                  <div className="flex flex-col gap-2 p-1 text-[12px] leading-[17px] text-ink">
                    <p className="font-bold">Editing the letter</p>
                    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-muted">
                      <li>Replace codes like ##COMPANY_NAME# are filled in for each company when the letter prints.</li>
                      <li>The greeting, offer box, sign-off, letterhead and footer are added for you — no need to type them.</li>
                      <li>Pasted text arrives as plain text, so formatting from Word or email doesn’t come along.</li>
                      <li>Images need a public https:// address. Links can be web, email (mailto:) or phone (tel:).</li>
                      <li>Shortcuts: Ctrl+B bold · Ctrl+I italic · Ctrl+Z undo · Ctrl+Y redo.</li>
                      <li>Use “Print a test letter” to check it on paper before a real run.</li>
                    </ul>
                  </div>
                )}
              </Popover>
              <Sep />
              <Popover
                align="start"
                fixed
                panelClassName="w-[300px] max-h-[460px] overflow-y-auto scroll-area"
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    onMouseDown={() => saveSelection()}
                    disabled={locked}
                    aria-expanded={open}
                    className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold text-ink hover:bg-white disabled:opacity-50"
                  >
                    <Icon icon={faBars} size={10} />
                    Insert replace code
                  </button>
                )}
              >
                {(close) => (
                  <ul className="flex flex-col">
                    {MENU_CODES.map((c) => (
                      <li key={c.code}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => (insertCode(c.code), close())}
                          className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-mint"
                        >
                          <span className="text-[13px] font-medium leading-[18px] text-ink">{c.code}</span>
                          <span className="text-[11px] leading-[15px] text-muted">{codeExample(c, { ...preview.values, OFFER: offer })}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Popover>
            </div>
          </div>

          {source !== null ? (
            <textarea
              value={source}
              onChange={(e) => (setSource(e.target.value), touch())}
              spellCheck={false}
              aria-label="Letter content — HTML source"
              className={cn("block w-full resize-y bg-white px-5 py-4 font-mono text-[12px] leading-[19px] text-ink outline-none", fullscreen ? "flex-1 resize-none" : "min-h-[300px]")}
            />
          ) : null}

          {/* Editable letter body */}
          <div
            ref={editorRef}
            contentEditable={!ro}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Letter content"
            aria-readonly={ro}
            spellCheck
            hidden={source !== null}
            onInput={syncHtml}
            onPaste={(e) => {
              // Paste as plain text so no foreign formatting/markup sneaks in.
              e.preventDefault();
              document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
              syncHtml();
            }}
            className={cn(
              "letter-body letter-body--editor px-5 py-4 text-[13px] leading-[20px] text-ink outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_h2]:my-3 [&_h3]:my-3 [&_img]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_s]:line-through [&_table]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_.indent-1]:pl-6 [&_.indent-2]:pl-12 [&_.indent-3]:pl-18",
              fullscreen ? "flex-1 overflow-y-auto" : "min-h-[300px]",
            )}
          />
        </div>
        {source !== null ? (
          <Note tone="neutral" icon={faCode}>
            You’re editing the HTML. Click the <strong>&lt;/&gt;</strong> button again to go back — anything a letter can’t contain (scripts, styles, other tags) is removed.
          </Note>
        ) : null}
        {unknownCodes.length ? (
          <Note tone="warning" icon={faCircleInfo}>
            Unknown replace {unknownCodes.length === 1 ? "code" : "codes"}: {unknownCodes.join(", ")} — {unknownCodes.length === 1 ? "it" : "they"} would
            print as written. Check the spelling against the Replace codes tab.
          </Note>
        ) : null}

        {/* Offer & CTA */}
        <section className="rounded-[14px] border border-line bg-white p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold leading-4 text-ink">Offer &amp; call to action</h3>
            <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 text-[10px] font-medium text-ink">
              Shown in the box with the QR code
            </span>
          </div>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5 rounded-lg bg-canvas px-2.5 py-2 focus-within:ring-2 focus-within:ring-brand/20">
              <span className="text-[9px] leading-3 text-muted">Default offer (##OFFER#)</span>
              <input
                value={offer}
                maxLength={200}
                disabled={ro}
                onChange={(e) => (setOffer(e.target.value), touch())}
                placeholder="e.g. Business Starter from £65"
                className="bg-transparent text-[12px] font-medium text-ink outline-none"
              />
            </label>
            <label className="flex flex-col gap-0.5 rounded-lg bg-canvas px-2.5 py-2 focus-within:ring-2 focus-within:ring-brand/20">
              <span className="text-[9px] leading-3 text-muted">Call to action</span>
              <input
                value={cta}
                maxLength={200}
                disabled={ro}
                onChange={(e) => (setCta(e.target.value), touch())}
                placeholder="e.g. Scan the code or visit …"
                className="bg-transparent text-[12px] font-medium text-ink outline-none"
              />
            </label>
          </div>
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <section className="rounded-[14px] border border-line bg-white p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold leading-4 text-ink">Replace codes</h3>
            <span className="text-muted" title="Codes are swapped for each company's details when the letter prints">
              <Icon icon={faCircleInfo} size={10} />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {BODY_CODES.map((code) => (
              <button
                key={code}
                type="button"
                disabled={ro}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertCode(code)}
                className="inline-flex h-7 items-center rounded-md border border-line bg-canvas px-2.5 text-[10px] font-medium text-ink transition-colors hover:border-brand hover:bg-mint disabled:opacity-50"
              >
                {code}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-[14px] text-muted">Click a code to insert it where the cursor is, or type it — e.g. ##COMPANY_NAME#. Same format as eFiling.</p>
        </section>

        <section className="rounded-[14px] border border-line bg-white p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold leading-4 text-ink">Live preview</h3>
            <span className="inline-flex h-6 max-w-[60%] items-center truncate rounded-full border border-line px-2.5 text-[10px] font-medium text-ink" title={preview.recipient.companyName}>
              {preview.recipient.companyName}
            </span>
          </div>
          <div className="mt-3 flex justify-center rounded-lg bg-canvas py-3">
            <FitLetter letter={letter} max={340} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Tool({
  icon,
  label,
  onClick,
  children,
  disabled,
  pressed,
}: {
  icon?: IconDefinition;
  label: string;
  onClick: () => void;
  children?: ReactNode;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      aria-pressed={pressed}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-white disabled:opacity-40",
        pressed && "bg-white text-brand ring-1 ring-brand/30",
      )}
    >
      {icon ? <Icon icon={icon} size={11} /> : children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}

/** Toolbar dropdown (Styles / Format) — Figma: white pill with a chevron. */
function MenuButton({ label, disabled, onOpen, children }: { label: string; disabled?: boolean; onOpen: () => void; children: (close: () => void) => ReactNode }) {
  return (
    <Popover
      align="start"
      fixed
      panelClassName="w-[200px]"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onMouseDown={(e) => (e.preventDefault(), onOpen())}
          onClick={toggle}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-[12px] font-medium text-ink hover:border-n400 disabled:opacity-50"
        >
          {label}
          <Icon icon={faChevronDown} size={8} />
        </button>
      )}
    >
      {(close) => (
        <div role="menu" aria-label={label} className="flex flex-col gap-0.5">
          {children(close)}
        </div>
      )}
    </Popover>
  );
}

function MenuOption({ onPick, children }: { onPick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className="rounded-lg px-3 py-2 text-left text-[13px] leading-[18px] text-ink hover:bg-mint"
    >
      {children}
    </button>
  );
}

/** Toolbar button that opens a small form (link, image, table). */
function ToolPopover({
  icon,
  label,
  disabled,
  onOpen,
  width = 300,
  children,
}: {
  icon: IconDefinition;
  label: string;
  disabled?: boolean;
  onOpen: () => void;
  width?: number;
  children: (close: () => void) => ReactNode;
}) {
  return (
    <Popover
      align="start"
      fixed
      panelClassName="p-1"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          title={label}
          aria-label={label}
          aria-expanded={open}
          disabled={disabled}
          onMouseDown={(e) => (e.preventDefault(), onOpen())}
          onClick={toggle}
          className="inline-flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-white disabled:opacity-40"
        >
          <Icon icon={icon} size={11} />
        </button>
      )}
    >
      {(close) => (
        <div style={{ width }} className="flex flex-col gap-2.5 p-1.5">
          {children(close)}
        </div>
      )}
    </Popover>
  );
}

const fieldCls = "h-9 w-full rounded-lg border border-line bg-white px-3 text-[13px] text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15";
const labelCls = "flex flex-col gap-1 text-[11px] font-medium text-muted";
const smallBtn = "inline-flex h-8 items-center justify-center rounded-lg px-3 text-[12px] font-semibold";

function LinkTool({
  disabled,
  onOpen,
  onInsert,
  onLink,
  onUnlink,
}: {
  disabled?: boolean;
  onOpen: () => void;
  onInsert: (html: string) => void;
  onLink: (url: string) => void;
  onUnlink: () => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [hasSelection, setHasSelection] = useState(false);
  return (
    <ToolPopover
      icon={faLink}
      label="Link"
      disabled={disabled}
      onOpen={() => {
        onOpen();
        const sel = window.getSelection();
        setHasSelection(Boolean(sel && !sel.isCollapsed));
        setError("");
      }}
    >
      {(close) => (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const raw = url.trim();
            // Another scheme (javascript:, data:, file: …) is refused, not turned into https://.
            const otherScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^(https?:|mailto:|tel:)/i.test(raw);
            const href = otherScheme ? null : safeHref(/^(https?:|mailto:|tel:)/i.test(raw) ? raw : /@/.test(raw) ? `mailto:${raw}` : `https://${raw}`);
            if (!href) return setError("Use a web address, an email address or tel:+44…");
            if (hasSelection) onLink(href);
            else onInsert(`<a href="${escapeHtml(href)}">${escapeHtml(text.trim() || raw)}</a>&nbsp;`);
            setUrl("");
            setText("");
            close();
          }}
        >
          <label className={labelCls}>
            Address
            <input autoFocus value={url} onChange={(e) => (setUrl(e.target.value), setError(""))} placeholder="abfaccounting.com/pricing" className={fieldCls} />
          </label>
          {hasSelection ? null : (
            <label className={labelCls}>
              Text to show
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Optional — the address if empty" className={fieldCls} />
            </label>
          )}
          {error ? <p className="text-[11px] text-danger">{error}</p> : null}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => (onUnlink(), close())} className={cn(smallBtn, "gap-1.5 text-muted hover:bg-canvas")}>
              <Icon icon={faLinkSlash} size={10} />
              Remove link
            </button>
            <button type="submit" className={cn(smallBtn, "ml-auto bg-brand text-white hover:bg-brand-hover")}>
              {hasSelection ? "Link selected text" : "Insert link"}
            </button>
          </div>
        </form>
      )}
    </ToolPopover>
  );
}

function ImageTool({ disabled, onOpen, onInsert }: { disabled?: boolean; onOpen: () => void; onInsert: (html: string) => void }) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [width, setWidth] = useState(IMAGE_SIZES[1].width);
  const [error, setError] = useState("");
  return (
    <ToolPopover icon={faImage} label="Image" disabled={disabled} onOpen={() => (onOpen(), setError(""))}>
      {(close) => (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const safe = safeImageSrc(src);
            if (!safe) return setError("Paste a public image address starting with https://");
            onInsert(`<img src="${escapeHtml(safe)}" alt="${escapeHtml(alt.trim())}" width="${width}">`);
            setSrc("");
            setAlt("");
            close();
          }}
        >
          <label className={labelCls}>
            Image address (https)
            <input autoFocus value={src} onChange={(e) => (setSrc(e.target.value), setError(""))} placeholder="https://abfaccounting.com/…/logo.png" className={fieldCls} />
          </label>
          <label className={labelCls}>
            Description (for screen readers)
            <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="e.g. ABF Accounting logo" className={fieldCls} />
          </label>
          <div className={labelCls}>
            Size
            <div className="flex gap-1.5">
              {IMAGE_SIZES.map((s) => (
                <button
                  key={s.width}
                  type="button"
                  aria-pressed={width === s.width}
                  onClick={() => setWidth(s.width)}
                  className={cn("h-8 flex-1 rounded-lg border text-[12px] font-medium", width === s.width ? "border-brand bg-mint text-brand" : "border-line text-ink hover:bg-canvas")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="text-[11px] text-danger">{error}</p> : null}
          <button type="submit" className={cn(smallBtn, "self-end bg-brand text-white hover:bg-brand-hover")}>
            Insert image
          </button>
        </form>
      )}
    </ToolPopover>
  );
}

function TableTool({ disabled, onOpen, onInsert }: { disabled?: boolean; onOpen: () => void; onInsert: (html: string) => void }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(2);
  const [header, setHeader] = useState(true);
  return (
    <ToolPopover icon={faTable} label="Table" disabled={disabled} onOpen={onOpen} width={240}>
      {(close) => (
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const cells = (tag: string) => `<tr>${Array.from({ length: cols }, () => `<${tag}></${tag}>`).join("")}</tr>`;
            const head = header ? `<thead>${cells("th")}</thead>` : "";
            const body = Array.from({ length: Math.max(1, rows - (header ? 1 : 0)) }, () => cells("td")).join("");
            onInsert(`<table>${head}<tbody>${body}</tbody></table><p><br></p>`);
            close();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls}>
              Rows
              <input type="number" min={1} max={12} value={rows} onChange={(e) => setRows(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className={fieldCls} />
            </label>
            <label className={labelCls}>
              Columns
              <input type="number" min={1} max={6} value={cols} onChange={(e) => setCols(Math.min(6, Math.max(1, Number(e.target.value) || 1)))} className={fieldCls} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-ink">
            <input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} className="size-4 accent-brand" />
            First row is a header
          </label>
          <button type="submit" className={cn(smallBtn, "self-end bg-brand text-white hover:bg-brand-hover")}>
            Insert table
          </button>
        </form>
      )}
    </ToolPopover>
  );
}
