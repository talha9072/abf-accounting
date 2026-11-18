"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { faCheck, faCopy, faDownload, faKey, faShieldHalved, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  startTwoFactorSetupAction,
} from "@/lib/auth/two-factor-actions";

type Dialog = null | "setup" | "disable" | "codes";

export function TwoStepRow({ enabled, codesLeft }: { enabled: boolean; codesLeft: number }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium leading-[18px] text-ink">Two-step sign-in</span>
        <span className="text-[11px] leading-[15px] text-muted">
          {enabled ? (
            <>
              On — a code from your authenticator app when signing in on a new computer · {codesLeft} recovery{" "}
              {codesLeft === 1 ? "code" : "codes"} left ·{" "}
              <button type="button" onClick={() => setDialog("codes")} className="font-medium text-brand hover:underline">
                New recovery codes
              </button>
            </>
          ) : (
            "Codes from an authenticator app when signing in on a new computer"
          )}
        </span>
      </div>
      <Toggle
        label="Two-step sign-in"
        checked={enabled}
        onChange={() => setDialog(enabled ? "disable" : "setup")}
      />

      {dialog === "setup" ? <SetupModal onClose={close} /> : null}
      {dialog === "disable" ? <DisableModal onClose={close} /> : null}
      {dialog === "codes" ? <NewCodesModal onClose={close} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Turn on: scan → confirm a code → save recovery codes                 */
/* ------------------------------------------------------------------ */

function SetupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();

  // A fresh secret each time the dialog opens.
  useEffect(() => {
    let live = true;
    startTwoFactorSetupAction().then((r) => {
      if (!live) return;
      if (r.ok) setSetup({ qr: r.qr, secret: r.secret });
      else setError({ message: r.message });
    });
    return () => {
      live = false;
    };
  }, []);

  const finish = () => {
    onClose();
    router.refresh();
  };

  if (codes) {
    return (
      <Modal open onClose={finish} width={560} icon={faCheck} title="Two-step sign-in is on" subtitle="Save these recovery codes somewhere safe, away from this computer.">
        <RecoveryCodes codes={codes} />
        <div className="flex pt-1.5">
          <Button icon={faCheck} onClick={finish} className="ml-auto">
            I’ve saved them
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      icon={faShieldHalved}
      title="Turn on two-step sign-in"
      subtitle="You’ll need your phone to sign in on a new computer."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const code = String(new FormData(e.currentTarget).get("code") ?? "");
          start(async () => {
            const r = await confirmTwoFactorSetupAction({ code });
            if (r.ok) setCodes(r.codes);
            else setError({ field: r.field, message: r.message });
          });
        }}
        className="flex flex-col gap-[18px]"
      >
        {error && !error.field ? (
          <p role="alert" className="rounded-[10px] bg-danger-subtle px-3.5 py-3 text-[12px] text-[#7f1d1d]">
            {error.message}
          </p>
        ) : null}

        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-[18px] text-ink">
          <li>Open an authenticator app on your phone — Google Authenticator, Microsoft Authenticator, 1Password or Authy.</li>
          <li>Add an account and scan this QR code.</li>
          <li>Type the 6-digit code the app shows.</li>
        </ol>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-canvas p-4 sm:flex-row sm:items-start">
          <div className="flex size-[168px] shrink-0 items-center justify-center rounded-xl bg-white p-2">
            {setup ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={setup.qr} alt="QR code for your authenticator app" width={152} height={152} />
            ) : (
              <Icon icon={faSpinner} size={18} spin className="text-muted" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1.5 text-[12px] leading-[17px] text-muted">
            <span>Can’t scan it? Choose “Enter a setup key” in the app and type:</span>
            <code className="break-all rounded-lg bg-white px-2.5 py-2 font-mono text-[13px] font-semibold tracking-wide text-ink">
              {setup?.secret ?? "…"}
            </code>
            <span>Account: ABF New Companies · Time based</span>
          </div>
        </div>

        <Field label="6-digit code from the app" htmlFor="tf-code" error={error?.field === "code" ? error.message : undefined}>
          <Input
            id="tf-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123 456"
            maxLength={7}
            className="tracking-[0.3em]"
            aria-invalid={error?.field === "code"}
            autoFocus
          />
        </Field>

        <div className="flex gap-3 pt-1.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={pending ? faSpinner : faCheck} disabled={pending || !setup} className="ml-auto">
            {pending && setup ? "Checking…" : "Turn on"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Turn off / new recovery codes — both need the password               */
/* ------------------------------------------------------------------ */

function PasswordForm({
  submitLabel,
  danger,
  onSubmit,
  onClose,
}: {
  submitLabel: string;
  danger?: boolean;
  onSubmit: (password: string) => Promise<{ field?: string; message: string } | null>;
  onClose: () => void;
}) {
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const password = String(new FormData(e.currentTarget).get("password") ?? "");
        start(async () => setError(await onSubmit(password)));
      }}
      className="flex flex-col gap-[18px]"
    >
      {error && !error.field ? (
        <p role="alert" className="rounded-[10px] bg-danger-subtle px-3.5 py-3 text-[12px] text-[#7f1d1d]">
          {error.message}
        </p>
      ) : null}
      <Field label="Your password" htmlFor="tf-password" error={error?.field === "password" ? error.message : undefined}>
        <Input id="tf-password" name="password" type="password" autoComplete="current-password" required aria-invalid={error?.field === "password"} autoFocus />
      </Field>
      <div className="flex gap-3 pt-1.5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant={danger ? "danger" : "primary"} icon={pending ? faSpinner : faCheck} disabled={pending} className="ml-auto">
          {pending ? "Checking…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function DisableModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      icon={faShieldHalved}
      iconTone="danger"
      title="Turn off two-step sign-in?"
      subtitle="Your account will only be protected by your password. Your recovery codes stop working."
    >
      <PasswordForm
        danger
        submitLabel="Turn off"
        onClose={onClose}
        onSubmit={async (password) => {
          const r = await disableTwoFactorAction({ password });
          if (!r.ok) return { field: r.field, message: r.message };
          toast({ message: r.message });
          onClose();
          router.refresh();
          return null;
        }}
      />
    </Modal>
  );
}

function NewCodesModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [codes, setCodes] = useState<string[] | null>(null);
  const finish = () => {
    onClose();
    router.refresh();
  };
  return (
    <Modal
      open
      onClose={codes ? finish : onClose}
      width={560}
      icon={faKey}
      title={codes ? "Your new recovery codes" : "Get new recovery codes"}
      subtitle={codes ? "Your old codes no longer work. Save these somewhere safe." : "Your old codes stop working as soon as new ones are made."}
    >
      {codes ? (
        <>
          <RecoveryCodes codes={codes} />
          <div className="flex pt-1.5">
            <Button icon={faCheck} onClick={finish} className="ml-auto">
              I’ve saved them
            </Button>
          </div>
        </>
      ) : (
        <PasswordForm
          submitLabel="Make new codes"
          onClose={onClose}
          onSubmit={async (password) => {
            const r = await regenerateRecoveryCodesAction({ password });
            if (!r.ok) return { field: r.field, message: r.message };
            setCodes(r.codes);
            return null;
          }}
        />
      )}
    </Modal>
  );
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const toast = useToast();
  const text = `ABF New Companies — recovery codes\nEach code works once. Use one if you can't get a code from your app.\n\n${codes.join("\n")}\n`;
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-canvas p-4 font-mono text-[14px] font-semibold tracking-wide text-ink">
        {codes.map((c) => (
          <li key={c} className="rounded-lg bg-white px-3 py-2 text-center">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={faCopy}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast({ message: "Recovery codes copied" });
            } catch {
              toast({ message: "Couldn’t copy — select the codes and copy them by hand" });
            }
          }}
        >
          Copy
        </Button>
        <Button
          variant="secondary"
          icon={faDownload}
          onClick={() => {
            const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "abf-recovery-codes.txt";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download
        </Button>
      </div>
      <p className="text-[12px] leading-[17px] text-muted">
        Lost your phone? Sign in with one of these codes instead of the 6-digit code, then turn two-step sign-in off and on again with your new phone.
      </p>
    </div>
  );
}
