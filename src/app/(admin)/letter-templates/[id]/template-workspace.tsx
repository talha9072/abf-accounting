"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  faCircleInfo,
  faClock,
  faClone,
  faEye,
  faFile,
  faFloppyDisk,
  faMagnifyingGlass,
  faPlus,
  faPrint,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge, CountPill, type Tone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Radio } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createTemplateAction, duplicateTemplateAction } from "@/lib/templates/actions";
import type { TemplateListItem, TemplateStatus } from "@/lib/templates/queries";
import { cn } from "@/lib/cn";

const STATUS: Record<TemplateStatus, { tone: Tone; label: string }> = {
  active: { tone: "success", label: "Active" },
  draft: { tone: "neutral", label: "Draft" },
  archived: { tone: "neutral", label: "Archived" },
};

/* ------------------------------------------------------------------ */
/* Editor context: tabs tell the workspace they have unsaved edits and */
/* register what "Save changes" should do.                             */
/* ------------------------------------------------------------------ */

type SaveFn = () => Promise<boolean>;
type EditorCtx = { markDirty: (d: boolean) => void; registerSave: (fn: SaveFn | null) => void; saving: boolean };
const EditorContext = createContext<EditorCtx>({ markDirty: () => {}, registerSave: () => {}, saving: false });
export const useTemplateEditor = () => useContext(EditorContext);
/** Back-compat alias used by older tab code. */
export const useMarkDirty = () => useContext(EditorContext).markDirty;

type Current = { id: string; name: string; status: TemplateStatus; isDefault: boolean; version: string };

export function TemplateWorkspace({ list, template, children }: { list: TemplateListItem[]; template: Current; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<"new" | "leave" | null>(null);
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const saveRef = useRef<SaveFn | null>(null);
  const [busy, start] = useTransition();
  const base = `/letter-templates/${template.id}`;

  const registerSave = useCallback((fn: SaveFn | null) => {
    saveRef.current = fn;
    setHasSave(Boolean(fn));
  }, []);

  const save = useCallback(async () => {
    if (!saveRef.current) return false;
    setSaving(true);
    try {
      const ok = await saveRef.current();
      if (ok) setDirty(false);
      return ok;
    } finally {
      setSaving(false);
    }
  }, []);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /** Ask before leaving the editor (other template, or another tab) with unsaved edits. */
  const guard = (href: string) => (e: MouseEvent) => {
    if (!dirty || href === pathname) return;
    e.preventDefault();
    setPendingHref(href);
    setModal("leave");
  };
  const leave = async (doSave: boolean) => {
    if (doSave && !(await save())) {
      setModal(null);
      return;
    }
    setDirty(false);
    setModal(null);
    if (pendingHref) router.push(pendingHref);
  };

  const shown = useMemo(() => list.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase())), [list, q]);
  const tabs = [
    { label: "Content", href: base },
    { label: "Replace codes", href: `${base}/replace-codes` },
    { label: "Settings", href: `${base}/settings` },
    { label: "Version history", href: `${base}/versions` },
  ];
  const meta = list.find((t) => t.id === template.id);

  const duplicate = () =>
    start(async () => {
      const r = await duplicateTemplateAction(template.id);
      toast({ message: r.message });
      if (r.ok) router.push(`/letter-templates/${r.id}`);
    });

  return (
    <>
      <PageHeader
        title="Letter Templates"
        description="Edit the letter that gets printed. Replace codes fill in each company’s name, address and details automatically."
        actions={
          <>
            <Button variant="secondary" icon={busy ? faSpinner : faClone} onClick={duplicate} disabled={busy}>
              Duplicate
            </Button>
            <Button icon={faPlus} onClick={() => setModal("new")}>
              New template
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 [&>*]:min-w-0 items-start gap-4 xl:grid-cols-[392px_minmax(0,1fr)]">
        {/* Library */}
        <aside aria-label="Templates" className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-4 xl:sticky xl:top-[100px] xl:min-h-[calc(100vh-232px)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold leading-[22px] text-ink">Templates</h2>
            <CountPill>{list.length} total</CountPill>
          </div>
          <label className="flex h-[38px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-[11px] text-muted focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand/15">
            <Icon icon={faMagnifyingGlass} size={11} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search templates"
              aria-label="Search templates"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-muted"
            />
          </label>
          <ul className="flex flex-col gap-3">
            {shown.map((t) => {
              const active = t.id === template.id;
              return (
                <li key={t.id}>
                  <Link
                    href={`/letter-templates/${t.id}`}
                    onClick={guard(`/letter-templates/${t.id}`)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[92px] flex-col gap-[7px] rounded-[10px] border p-3 transition-colors",
                      active ? "border-brand/25 bg-mint" : "border-line bg-canvas hover:border-n400",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold leading-4 text-ink">{t.name}</span>
                      <StatusBadge tone={STATUS[t.status].tone} size="sm" className={t.status === "active" ? "bg-transparent" : ""}>
                        {STATUS[t.status].label}
                      </StatusBadge>
                    </span>
                    <span className="text-[10px] leading-[14px] text-muted">{t.usage}</span>
                    <span className="flex items-center gap-1.5 text-[9px] leading-3 text-muted">
                      <Icon icon={faClock} size={8} />
                      {t.edited}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            <a
              href={`/print-doc/test/${template.id}?auto=1`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 self-start text-[12px] font-medium text-ink hover:text-brand"
            >
              <span className="text-muted">
                <Icon icon={faPrint} size={11} />
              </span>
              Print a test letter
            </a>
            <p className="flex items-center gap-1.5 text-[10px] leading-[13px] text-muted">
              <Icon icon={faCircleInfo} size={9} />
              Archived templates stay available for past print runs.
            </p>
          </div>
        </aside>

        {/* Editor */}
        <section aria-label="Template editor" className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-line bg-white">
          <header className="flex min-h-[74px] flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="flex flex-col gap-[3px]">
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-bold leading-6 text-ink">{template.name}</h2>
                <StatusBadge tone={STATUS[template.status].tone} size="sm">
                  {STATUS[template.status].label}
                </StatusBadge>
                <span className="text-[11px] font-medium text-muted">{template.version}</span>
                {dirty ? <span className="text-[11px] font-medium text-warning">· Unsaved changes</span> : null}
              </div>
              <p className="text-[10px] leading-[13px] text-muted">
                {template.isDefault ? "Default letter · used for every print run unless you pick another" : meta?.usage}
              </p>
            </div>
            <div className="flex gap-2">
              <ButtonLink variant="secondary" icon={faEye} href={`/print-doc/test/${template.id}`} target="_blank" rel="noopener">
                Preview
              </ButtonLink>
              <Button icon={saving ? faSpinner : faFloppyDisk} onClick={() => void save()} disabled={!hasSave || saving || !dirty}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </header>
          <nav aria-label="Template sections" className="flex h-[46px] items-center gap-1 bg-canvas px-[18px]">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={guard(t.href)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-[30px] items-center rounded-lg border px-3 text-[11px] leading-[14px] transition-colors",
                    active ? "border-line bg-white font-bold text-ink" : "border-transparent font-medium text-muted hover:text-ink",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-[18px]">
            <EditorContext value={{ markDirty: setDirty, registerSave, saving }}>{children}</EditorContext>
          </div>
        </section>
      </div>

      <NewTemplateModal open={modal === "new"} onClose={() => setModal(null)} from={{ id: template.id, name: template.name }} />
      <Modal
        open={modal === "leave"}
        onClose={() => setModal(null)}
        width={480}
        icon={faTriangleExclamation}
        iconTone="danger"
        title="Leave without saving?"
        subtitle={`You have unsaved changes to ${template.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => void leave(false)}>
              Discard changes
            </Button>
            <Button icon={saving ? faSpinner : faFloppyDisk} className="ml-auto" onClick={() => void leave(true)} disabled={saving}>
              Save &amp; leave
            </Button>
          </>
        }
      />
    </>
  );
}

function NewTemplateModal({ open, onClose, from }: { open: boolean; onClose: () => void; from: { id: string; name: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"copy" | "blank">("copy");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const create = () =>
    start(async () => {
      const r = await createTemplateAction({ name, copyFrom: mode === "copy" ? from.id : null });
      if (!r.ok) return setError(r.fieldErrors?.name?.[0] ?? r.message);
      toast({ message: r.message });
      onClose();
      setName("");
      router.push(`/letter-templates/${r.id}`);
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      icon={faFile}
      title="New template"
      subtitle="Start from the current template or a blank letter"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={pending ? faSpinner : faPlus} className="ml-auto" onClick={create} disabled={pending}>
            Create template
          </Button>
        </>
      }
    >
      <Field label="Template name" htmlFor="tpl-name" error={error}>
        <Input
          id="tpl-name"
          value={name}
          onChange={(e) => (setName(e.target.value), setError(null))}
          placeholder={`${from.name.replace(/v(\d+)$/, (_, n) => `v${Number(n) + 1}`)}`}
          maxLength={120}
          autoFocus
        />
      </Field>
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Start from</legend>
        <Radio
          name="tpl-start"
          checked={mode === "copy"}
          onChange={() => setMode("copy")}
          label={`Copy ${from.name}`}
          description="Keeps the letter text, greeting, offer and sign-off"
        />
        <Radio
          name="tpl-start"
          checked={mode === "blank"}
          onChange={() => setMode("blank")}
          label="Blank letter"
          description="Letterhead, address block and exclude footer are still added"
        />
      </fieldset>
      <p className="text-[11px] leading-[15px] text-muted">New templates start as a Draft — set them to Active in Settings to use them for printing.</p>
    </Modal>
  );
}
