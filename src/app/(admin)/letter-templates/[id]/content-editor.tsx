"use client";

import { useRef, type ReactNode } from "react";
import {
  faBars,
  faBold,
  faChevronDown,
  faCircleInfo,
  faCode,
  faExpand,
  faGripLines,
  faImage,
  faIndent,
  faItalic,
  faLink,
  faListOl,
  faListUl,
  faOutdent,
  faQuestion,
  faQuoteLeft,
  faRotateLeft,
  faRotateRight,
  faStrikethrough,
  faTable,
  faTextSlash,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { PrintedLetter } from "@/components/admin/printed-letter";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Popover } from "@/components/ui/popover";
import { replaceCodes } from "@/lib/mock-data";
import { useMarkDirty } from "./template-workspace";

const CHIP_CODES = [
  "##DIRECTOR_FIRSTNAME#", "##REFERENCE#", "##COMPANY_NAME#", "##QR_CODE#", "##REGISTERED_ADDRESS#",
  "##OFFER#", "##COMPANY_NUMBER#", "##BRAND_NAME#", "##INCORPORATION_DATE#", "##LETTER_HEAD#", "##LETTER_FOOTER#",
];

const MENU_CODES = replaceCodes.filter((c) =>
  [
    "##DIRECTOR_FIRSTNAME#", "##COMPANY_NAME#", "##REGISTERED_ADDRESS#", "##COMPANY_NUMBER#", "##INCORPORATION_DATE#",
    "##REFERENCE#", "##OFFER#", "##QR_CODE#", "##BRAND_NAME#", "##LETTER_HEAD#", "##LETTER_FOOTER#",
  ].includes(c.code),
);

/**
 * Initial letter body. Static, trusted markup — when templates are loaded from
 * the database this HTML must be sanitised (allow-list) before rendering.
 */
const INITIAL_HTML = `
<p>##LETTER_HEAD#</p>
<p>Dear ##DIRECTOR_FIRSTNAME#,</p>
<p>Congratulations on incorporating ##COMPANY_NAME# on ##INCORPORATION_DATE#.</p>
<p>ABF Accounting helps new UK companies get their bookkeeping, accounts and filings right from day one, with a dedicated accountant and clear fixed prices.</p>
<p><span class="text-brand">Current offer:</span>&nbsp; <span class="code-chip" contenteditable="false">##OFFER#</span></p>
<p>Our Business Starter services start from £65, and our Full Compliance Pack covers your Confirmation Statement, annual accounts and Corporation Tax return for a fixed £300. Scan the QR code or quote ##REFERENCE# when you get in touch.</p>
<p>Kind regards,</p>
<p>##BRAND_NAME#</p>
<p>Tel: ##BRAND_SUPPORT_TELEPHONE#<br>Email: ##BRAND_SUPPORT_EMAIL#</p>
<p>##LETTER_FOOTER#</p>`;

export function ContentEditor({ name }: { name: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const markDirty = useMarkDirty();

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    // execCommand is deprecated but still the simplest dependency-free option
    // for a design-stage editor. Swap for TipTap/Lexical when wiring saving.
    document.execCommand(command, false, value);
    markDirty(true);
  };
  const insertCode = (code: string) => exec("insertText", code);

  return (
    <div className="grid items-start gap-4 min-[1680px]:grid-cols-[minmax(0,664fr)_452fr]">
      <div className="flex min-w-0 flex-col gap-3.5">
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
          defaultValue={name}
          maxLength={120}
          required
          onChange={() => markDirty(true)}
          className="h-10 rounded-[9px] px-3"
        />

        <p className="mt-1 flex items-center gap-2 text-[12px] font-medium leading-4 text-ink">
          Letter content <span className="text-[10px] font-normal text-muted">Replace codes fill automatically</span>
        </p>

        <div className="overflow-hidden rounded-[10px] border border-line bg-white">
          {/* Toolbar */}
          <div role="toolbar" aria-label="Formatting" className="flex flex-col gap-2 border-b border-line bg-canvas px-2.5 py-2.5">
            <div className="flex flex-wrap items-center gap-1">
              <Tool icon={faRotateLeft} label="Undo" onClick={() => exec("undo")} />
              <Tool icon={faRotateRight} label="Redo" onClick={() => exec("redo")} />
              <Sep />
              <Tool icon={faBold} label="Bold" onClick={() => exec("bold")} />
              <Tool icon={faItalic} label="Italic" onClick={() => exec("italic")} />
              <Tool icon={faStrikethrough} label="Strikethrough" onClick={() => exec("strikeThrough")} />
              <Tool icon={faTextSlash} label="Clear formatting" onClick={() => exec("removeFormat")} />
              <Sep />
              <Tool icon={faListOl} label="Numbered list" onClick={() => exec("insertOrderedList")} />
              <Tool icon={faListUl} label="Bullet list" onClick={() => exec("insertUnorderedList")} />
              <Tool icon={faOutdent} label="Outdent" onClick={() => exec("outdent")} />
              <Tool icon={faIndent} label="Indent" onClick={() => exec("indent")} />
              <Tool icon={faQuoteLeft} label="Quote" onClick={() => exec("formatBlock", "blockquote")} />
              <Sep />
              <Tool icon={faLink} label="Link" onClick={() => {}} />
              <Tool icon={faImage} label="Image" onClick={() => {}} />
              <Tool icon={faTable} label="Table" onClick={() => {}} />
              <Tool icon={faGripLines} label="Horizontal line" onClick={() => exec("insertHorizontalRule")} />
              <Tool label="Special character" onClick={() => exec("insertText", "£")}>
                <span className="text-[13px] font-semibold">Ω</span>
              </Tool>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <SelectTool label="Styles" />
              <SelectTool label="Format" />
              <Sep />
              <Tool icon={faExpand} label="Full screen" onClick={() => {}} />
              <Tool icon={faCode} label="Source code" onClick={() => {}} />
              <Tool icon={faQuestion} label="Help" onClick={() => {}} />
              <Sep />
              <Popover
                align="start"
                panelClassName="w-[300px] max-h-[460px] overflow-y-auto scroll-area"
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    className="inline-flex h-8 items-center gap-2 rounded-lg px-2.5 text-[11px] font-semibold text-ink hover:bg-white"
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
                          onClick={() => {
                            insertCode(c.code);
                            close();
                          }}
                          className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left hover:bg-mint"
                        >
                          <span className="text-[13px] font-medium leading-[18px] text-ink">{c.code}</span>
                          <span className="text-[11px] leading-[15px] text-muted">{c.menu}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Popover>
            </div>
          </div>

          {/* Editable letter body */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Letter content"
            spellCheck
            onInput={() => markDirty(true)}
            className="min-h-[360px] px-5 py-4 text-[12px] leading-[18px] text-ink outline-none [&_.code-chip]:rounded-full [&_.code-chip]:bg-mint [&_.code-chip]:px-2.5 [&_.code-chip]:py-1 [&_.code-chip]:font-medium [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: INITIAL_HTML }}
          />
        </div>

        {/* Offer & CTA */}
        <section className="rounded-[14px] border border-line bg-white p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold leading-4 text-ink">Offer &amp; call to action</h3>
            <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 text-[10px] font-medium text-ink">
              Applies to every letter
            </span>
          </div>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5 rounded-lg bg-canvas px-2.5 py-2">
              <span className="text-[9px] leading-3 text-muted">Default offer</span>
              <input
                defaultValue="Business Starter from £65"
                onChange={() => markDirty(true)}
                className="bg-transparent text-[11px] font-medium text-ink outline-none"
              />
            </label>
            <label className="flex flex-col gap-0.5 rounded-lg bg-canvas px-2.5 py-2">
              <span className="text-[9px] leading-3 text-muted">CTA</span>
              <input
                defaultValue="See Business Starter →"
                onChange={() => markDirty(true)}
                className="bg-transparent text-[11px] font-medium text-ink outline-none"
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
            {CHIP_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => insertCode(code)}
                className="inline-flex h-7 items-center rounded-md border border-line bg-canvas px-2.5 text-[10px] font-medium text-ink transition-colors hover:border-brand hover:bg-mint"
              >
                {code}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-[14px] text-muted">
            Click a code to insert it, or type it — e.g. ##COMPANY_NAME#. Same format as eFiling.
          </p>
        </section>

        <section className="rounded-[14px] border border-line bg-white p-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold leading-4 text-ink">Live preview</h3>
            <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 text-[10px] font-medium text-ink">
              A4 front
            </span>
          </div>
          <div className="mt-3 flex justify-center rounded-lg bg-canvas py-3">
            <PrintedLetter width={300} />
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
}: {
  icon?: IconDefinition;
  label: string;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-lg text-ink transition-colors hover:bg-white"
    >
      {icon ? <Icon icon={icon} size={11} /> : children}
    </button>
  );
}

function SelectTool({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-white px-2.5 text-[12px] font-medium text-ink hover:border-n400"
    >
      {label}
      <span className="text-muted">
        <Icon icon={faChevronDown} size={8} />
      </span>
    </button>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-line" />;
}
