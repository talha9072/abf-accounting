"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  faBars,
  faBold,
  faCircleInfo,
  faGripLines,
  faIndent,
  faItalic,
  faListOl,
  faListUl,
  faLock,
  faOutdent,
  faQuoteLeft,
  faRotateLeft,
  faRotateRight,
  faStrikethrough,
  faTextSlash,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Note } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";
import { sanitizeTemplateHtml } from "@/lib/letters/html";
import { mergeCodes, mergeGreeting } from "@/lib/letters/merge";
import type { RenderedLetter } from "@/lib/letters/data";
import { saveContentAction } from "@/lib/templates/actions";
import type { PreviewContext } from "@/lib/templates/preview";
import { codeExample, REPLACE_CODES } from "@/lib/letters/codes";
import { useTemplateEditor } from "./template-workspace";

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
  const latest = useRef({ name, html, offer, cta });
  useEffect(() => {
    latest.current = { name, html, offer, cta };
  }, [name, html, offer, cta]);

  useEffect(() => {
    if (ro) return registerSave(null);
    registerSave(async () => {
      const v = latest.current;
      const r = await saveContentAction({ id: template.id, name: v.name, contentHtml: v.html, offer: v.offer, cta: v.cta });
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

  const exec = (command: string, value?: string) => {
    if (ro) return;
    editorRef.current?.focus();
    // execCommand is deprecated but still the simplest dependency-free rich-text option here.
    // The result is always re-sanitised on the server before it's stored or printed.
    document.execCommand(command, false, value);
    syncHtml();
  };
  const insertCode = (code: string) => exec("insertText", code);

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

        <div className="overflow-hidden rounded-[10px] border border-line bg-white">
          {/* Toolbar */}
          <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-line bg-canvas px-2.5 py-2.5">
            <Tool icon={faRotateLeft} label="Undo" onClick={() => exec("undo")} disabled={ro} />
            <Tool icon={faRotateRight} label="Redo" onClick={() => exec("redo")} disabled={ro} />
            <Sep />
            <Tool icon={faBold} label="Bold" onClick={() => exec("bold")} disabled={ro} />
            <Tool icon={faItalic} label="Italic" onClick={() => exec("italic")} disabled={ro} />
            <Tool icon={faStrikethrough} label="Strikethrough" onClick={() => exec("strikeThrough")} disabled={ro} />
            <Tool icon={faTextSlash} label="Clear formatting" onClick={() => exec("removeFormat")} disabled={ro} />
            <Sep />
            <Tool icon={faListOl} label="Numbered list" onClick={() => exec("insertOrderedList")} disabled={ro} />
            <Tool icon={faListUl} label="Bullet list" onClick={() => exec("insertUnorderedList")} disabled={ro} />
            <Tool icon={faOutdent} label="Outdent" onClick={() => exec("outdent")} disabled={ro} />
            <Tool icon={faIndent} label="Indent" onClick={() => exec("indent")} disabled={ro} />
            <Tool icon={faQuoteLeft} label="Quote" onClick={() => exec("formatBlock", "blockquote")} disabled={ro} />
            <Tool icon={faGripLines} label="Horizontal line" onClick={() => exec("insertHorizontalRule")} disabled={ro} />
            <Tool label="Pound sign" onClick={() => exec("insertText", "£")} disabled={ro}>
              <span className="text-[13px] font-semibold">£</span>
            </Tool>
            <Sep />
            <Popover
              align="start"
              panelClassName="w-[300px] max-h-[460px] overflow-y-auto scroll-area"
              trigger={({ toggle, open }) => (
                <button
                  type="button"
                  onClick={toggle}
                  disabled={ro}
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
            onInput={syncHtml}
            onPaste={(e) => {
              // Paste as plain text so no foreign formatting/markup sneaks in.
              e.preventDefault();
              document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
              syncHtml();
            }}
            className="min-h-[300px] px-5 py-4 text-[13px] leading-[20px] text-ink outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
          />
        </div>
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
            <PrintedLetter letter={letter} width={340} />
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
}: {
  icon?: IconDefinition;
  label: string;
  onClick: () => void;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-white disabled:opacity-40"
    >
      {icon ? <Icon icon={icon} size={11} /> : children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}
