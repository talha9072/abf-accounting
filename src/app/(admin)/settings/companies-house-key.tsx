"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { faCircleCheck, faCircleInfo, faKey, faLock, faSpinner, faTrashCan, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { removeCompaniesHouseKeyAction, saveCompaniesHouseKeyAction } from "@/lib/companies-house/actions";
import type { CompaniesHouseKeyStatus } from "@/lib/companies-house/key";
import { cn } from "@/lib/cn";

function savedLine(s: { hint: string; updatedAt: string; updatedBy: string | null }) {
  const when = new Date(s.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return `Key ending ••••${s.hint} · saved ${when}${s.updatedBy ? ` by ${s.updatedBy}` : ""}`;
}

export function CompaniesHouseKey({ status, canEdit }: { status: CompaniesHouseKeyStatus; canEdit: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, start] = useTransition();
  const [removing, startRemove] = useTransition();

  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 5000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const ok = status.state === "saved" || status.state === "env";
  const banner =
    status.state === "saved"
      ? { tone: "ok", text: `Connected. ${savedLine(status)}` }
      : status.state === "env"
        ? { tone: "info", text: "Using the key from the server’s settings file. Save it here to manage it in the app." }
        : status.state === "unreadable"
          ? { tone: "warn", text: `A key is saved but this server can’t read it (its encryption key changed). Paste the key again. ${savedLine(status)}` }
          : { tone: "warn", text: "No key yet — the morning pull is waiting for one." };

  return (
    <section id="companies-house" className="flex max-w-[1032px] scroll-mt-24 flex-col gap-4 rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[18px] font-bold leading-[25px] text-ink">Companies House</h2>
        <p className="text-[13px] leading-[18px] text-muted">
          The API key the morning pull uses to collect new companies. It’s stored encrypted and only the last 4 characters are ever shown.
        </p>
      </div>

      <p
        role="status"
        className={cn(
          "flex items-start gap-2.5 rounded-[10px] px-3.5 py-3 text-[13px] leading-[18px] text-ink",
          banner.tone === "ok" ? "bg-mint" : banner.tone === "warn" ? "bg-warning-subtle" : "bg-n100",
        )}
      >
        <Icon
          icon={banner.tone === "ok" ? faCircleCheck : banner.tone === "warn" ? faTriangleExclamation : faCircleInfo}
          size={13}
          className={cn("mt-0.5", banner.tone === "ok" ? "text-brand" : banner.tone === "warn" ? "text-warning" : "text-muted")}
        />
        {banner.text}
      </p>

      {canEdit ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const key = String(new FormData(form).get("chKey") ?? "");
            start(async () => {
              const r = await saveCompaniesHouseKeyAction(key);
              setError(r.ok ? null : (r.fieldError ?? r.message));
              toast({ message: r.message, tone: r.ok ? "success" : "error" });
              if (r.ok) {
                form.reset();
                router.refresh();
              }
            });
          }}
          className="flex flex-col gap-4"
        >
          <Field
            label={ok || status.state === "unreadable" ? "Replace the API key" : "API key"}
            htmlFor="ch-key"
            error={error}
            hint="developer.company-information.service.gov.uk → Your applications → your Live application → REST API key. It’s checked with Companies House before it’s saved."
          >
            <Input
              id="ch-key"
              name="chKey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              placeholder={status.state === "saved" ? `••••${status.hint} saved — paste a new key to replace it` : "Paste the REST API key"}
              aria-invalid={!!error}
              aria-describedby={error ? "ch-key-error" : "ch-key-hint"}
              onChange={() => error && setError(null)}
            />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {status.state === "saved" || status.state === "unreadable" ? (
              <Button
                variant={confirmRemove ? "danger" : "ghost"}
                icon={removing ? faSpinner : faTrashCan}
                disabled={removing || pending}
                onClick={() => {
                  if (!confirmRemove) return setConfirmRemove(true);
                  startRemove(async () => {
                    const r = await removeCompaniesHouseKeyAction();
                    toast({ message: r.message, tone: r.ok ? "success" : "error" });
                    setConfirmRemove(false);
                    if (r.ok) router.refresh();
                  });
                }}
              >
                {confirmRemove ? "Click again to remove" : "Remove key"}
              </Button>
            ) : null}
            <Button type="submit" icon={pending ? faSpinner : faKey} disabled={pending || removing}>
              {pending ? "Checking with Companies House…" : "Check & save key"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="flex items-start gap-2.5 rounded-[10px] bg-n100 px-3.5 py-3 text-[13px] leading-[18px] text-muted">
          <Icon icon={faLock} size={12} className="mt-0.5" />
          Only admins can change the Companies House key.
        </p>
      )}
    </section>
  );
}
