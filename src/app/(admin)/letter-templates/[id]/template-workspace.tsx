"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type MouseEvent, type ReactNode } from "react";
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
import { templates, type TemplateSummary } from "@/lib/mock-data";
import { cn } from "@/lib/cn";

const STATUS_TONE: Record<TemplateSummary["status"], Tone> = { Active: "success", Draft: "neutral", Archived: "neutral" };

/** Lets the content editor tell the workspace it has unsaved edits. */
const DirtyContext = createContext<(dirty: boolean) => void>(() => {});
export const useMarkDirty = () => useContext(DirtyContext);

export function TemplateWorkspace({ template, children }: { template: TemplateSummary; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [modal, setModal] = useState<"new" | "leave" | null>(null);
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const base = `/letter-templates/${template.id}`;

  /** Ask before leaving another template while there are unsaved edits. */
  const guard = (href: string) => (e: MouseEvent) => {
    if (!dirty || href.startsWith(base)) return;
    e.preventDefault();
    setPendingHref(href);
    setModal("leave");
  };
  const leave = (save: boolean) => {
    if (save) toast({ message: `${template.name} saved` });
    setDirty(false);
    setModal(null);
    if (pendingHref) router.push(pendingHref);
  };

  const list = useMemo(() => templates.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  const tabs = [
    { label: "Content", href: base },
    { label: "Replace codes", href: `${base}/replace-codes` },
    { label: "Settings", href: `${base}/settings` },
    { label: "Version history", href: `${base}/versions` },
  ];

  return (
    <>
      <PageHeader
        title="Letter Templates"
        description="Edit the letter that gets printed. Replace codes fill in each company’s name, address and details automatically."
        actions={
          <>
            <Button
              variant="secondary"
              icon={faClone}
              onClick={() => toast({ message: `Copy of ${template.name} created` })}
            >
              Duplicate
            </Button>
            <Button icon={faPlus} onClick={() => setModal("new")}>
              New template
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[392px_minmax(0,1fr)]">
        {/* Library */}
        <aside aria-label="Templates" className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-4 xl:sticky xl:top-[100px] xl:min-h-[calc(100vh-232px)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold leading-[22px] text-ink">Templates</h2>
            <CountPill>{templates.length} total</CountPill>
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
            {list.map((t) => {
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
                      <StatusBadge tone={STATUS_TONE[t.status]} size="sm" className={t.status === "Active" ? "bg-transparent" : ""}>
                        {t.status}
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
            <button type="button" className="inline-flex items-center gap-2 self-start text-[12px] font-medium text-ink hover:text-brand">
              <span className="text-muted">
                <Icon icon={faPrint} size={11} />
              </span>
              Print a test letter
            </button>
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
                <StatusBadge tone={STATUS_TONE[template.status]} size="sm">
                  {template.status}
                </StatusBadge>
              </div>
              <p className="text-[10px] leading-[13px] text-muted">
                {template.status === "Active" && template.usage.startsWith("Default")
                  ? "Default letter · used for every print run unless you pick another"
                  : template.usage}
              </p>
            </div>
            <div className="flex gap-2">
              <ButtonLink variant="secondary" icon={faEye} href="/print/preview">
                Preview
              </ButtonLink>
              <Button
                icon={faFloppyDisk}
                onClick={() => {
                  setDirty(false);
                  toast({ message: `${template.name} saved · used for the next print run` });
                }}
              >
                Save changes
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
            <DirtyContext value={setDirty}>{children}</DirtyContext>
          </div>
        </section>
      </div>

      <NewTemplateModal open={modal === "new"} onClose={() => setModal(null)} from={template.name} />
      <LeaveModal
        open={modal === "leave"}
        onClose={() => setModal(null)}
        onDiscard={() => leave(false)}
        onSave={() => leave(true)}
        name={template.name}
      />
    </>
  );
}

function NewTemplateModal({ open, onClose, from }: { open: boolean; onClose: () => void; from: string }) {
  const [mode, setMode] = useState<"copy" | "blank">("copy");
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={520}
      icon={faFile}
      title="New template"
      subtitle="Start from the current default or a blank letter"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={faPlus} className="ml-auto" onClick={onClose}>
            Create template
          </Button>
        </>
      }
    >
      <Field label="Template name" htmlFor="tpl-name">
        <Input id="tpl-name" defaultValue="Welcome Letter v4" maxLength={120} autoFocus />
      </Field>
      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Start from</legend>
        <Radio
          name="tpl-start"
          checked={mode === "copy"}
          onChange={() => setMode("copy")}
          label={`Copy ${from}`}
          description="Keeps the layout, replace codes and exclude footer"
        />
        <Radio
          name="tpl-start"
          checked={mode === "blank"}
          onChange={() => setMode("blank")}
          label="Blank letter"
          description="Exclude footer and address block are still added"
        />
      </fieldset>
    </Modal>
  );
}

function LeaveModal({
  open,
  onClose,
  onDiscard,
  onSave,
  name,
}: {
  open: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
  name: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      icon={faTriangleExclamation}
      iconTone="danger"
      title="Leave without saving?"
      subtitle={`You have unsaved changes to ${name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onDiscard}>
            Discard changes
          </Button>
          <Button icon={faFloppyDisk} className="ml-auto" onClick={onSave}>
            Save &amp; leave
          </Button>
        </>
      }
    />
  );
}
