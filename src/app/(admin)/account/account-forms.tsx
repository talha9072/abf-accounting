"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { faCheck, faKey, faLock, faRightFromBracket, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Button, buttonClasses } from "@/components/ui/button";
import { Toggle } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { changePasswordAction, signOutOtherDevicesAction, type FormState } from "@/lib/auth/actions";
import { saveDetailsAction, saveEmailPrefsAction } from "@/lib/account-actions";
import type { getMyAccount } from "@/lib/account";

type Account = Awaited<ReturnType<typeof getMyAccount>>;

function relative(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export function AccountForms({ account }: { account: Account }) {
  const toast = useToast();
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [otherState, signOutOthers] = useActionState<FormState, FormData>(signOutOtherDevicesAction, null);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [savingDetails, startDetails] = useTransition();
  const [pullEmail, setPullEmail] = useState(account.emailOnPullFailure);
  const [savingPrefs, startPrefs] = useTransition();

  useEffect(() => {
    if (otherState?.message) toast({ message: otherState.message });
  }, [otherState, toast]);

  const others = account.devices.filter((d) => !d.current);
  const devicesLine = [
    `${account.devices.find((d) => d.current)?.label ?? "This device"} (this one)`,
    ...others.slice(0, 2).map((d) => `${d.label} · signed in ${relative(d.lastSeenAt)}`),
  ].join(" · ");

  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 items-start gap-6 xl:grid-cols-[1032fr_520fr]">
      <div className="flex flex-col gap-6">
        {/* Your details */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            startDetails(async () => {
              const r = await saveDetailsAction({
                firstName: String(f.get("firstName") ?? ""),
                lastName: String(f.get("lastName") ?? ""),
                mobile: String(f.get("mobile") ?? ""),
              });
              setDetailErrors(r.ok ? {} : (r.fieldErrors ?? {}));
              toast({ message: r.message });
              if (r.ok) router.refresh();
            });
          }}
          noValidate
          className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[18px] font-bold leading-[25px] text-ink">Your details</h2>
            <span className="inline-flex h-8 items-center gap-2 rounded-lg bg-warning-subtle px-3 text-[12px] font-medium text-warning">
              <Icon icon={faLock} size={11} />
              Personal information
            </span>
          </div>
          <p className="text-[13px] leading-[18px] text-muted">
            Only you and your admins can see this. Your name appears in activity logs and notes.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name" htmlFor="acc-first" error={detailErrors.firstName}>
              <Input
                id="acc-first"
                name="firstName"
                defaultValue={account.firstName}
                autoComplete="given-name"
                maxLength={80}
                required
                aria-invalid={!!detailErrors.firstName}
              />
            </Field>
            <Field label="Last name" htmlFor="acc-last" error={detailErrors.lastName}>
              <Input
                id="acc-last"
                name="lastName"
                defaultValue={account.lastName}
                autoComplete="family-name"
                maxLength={80}
                required
                aria-invalid={!!detailErrors.lastName}
              />
            </Field>
            <Field label="Work email" htmlFor="acc-email" hint="Used to sign in and for password resets">
              <Input id="acc-email" type="email" name="email" defaultValue={account.email} autoComplete="email" readOnly />
            </Field>
            <Field
              label="Mobile (optional)"
              htmlFor="acc-mobile"
              hint={account.mobileMasked ? "Hidden for privacy — type a new number to replace it, or clear it" : "Only used for sign-in codes"}
              error={detailErrors.mobile}
            >
              <Input
                id="acc-mobile"
                type="tel"
                name="mobile"
                defaultValue={account.mobileMasked}
                placeholder="07700 900000"
                autoComplete="tel"
                maxLength={32}
                aria-invalid={!!detailErrors.mobile}
              />
            </Field>
          </div>
          <Button type="submit" icon={savingDetails ? faSpinner : faCheck} disabled={savingDetails} className="self-end">
            {savingDetails ? "Saving…" : "Save details"}
          </Button>
        </form>

        {/* Sign-in & security */}
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6">
          <h2 className="text-[18px] font-bold leading-[25px] text-ink">Sign-in &amp; security</h2>
          <Row title="Password" sub={`Last changed ${relative(account.passwordChangedAt)}`}>
            <Button variant="secondary" icon={faKey} onClick={() => setPwOpen(true)}>
              Change password
            </Button>
          </Row>
          <Row title="Two-step sign-in" sub="Coming soon — codes from an authenticator app when signing in on a new computer">
            <Toggle label="Two-step sign-in (coming soon)" checked={account.twoFactorEnabled} disabled readOnly className="cursor-not-allowed opacity-50" />
          </Row>
          <Row title="Signed-in devices" sub={devicesLine}>
            <form action={signOutOthers}>
              <SignOutOthersButton disabled={others.length === 0} />
            </form>
          </Row>
        </section>
      </div>

      {/* Emails */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startPrefs(async () => {
            const r = await saveEmailPrefsAction({ emailOnPullFailure: pullEmail });
            toast({ message: r.message });
          });
        }}
        className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6"
      >
        <h2 className="text-[18px] font-bold leading-[25px] text-ink">Emails</h2>
        <Row title="Email me if the morning pull fails" sub="So letters aren’t delayed">
          <Toggle label="Email me if the morning pull fails" checked={pullEmail} onChange={(e) => setPullEmail(e.target.checked)} />
        </Row>
        <Button type="submit" icon={savingPrefs ? faSpinner : faCheck} disabled={savingPrefs} className="self-end">
          {savingPrefs ? "Saving…" : "Save preferences"}
        </Button>
      </form>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

function Row({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium leading-[18px] text-ink">{title}</span>
        <span className="text-[11px] leading-[15px] text-muted">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function SignOutOthersButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={buttonClasses({ variant: "secondary" })}>
      <Icon icon={pending ? faSpinner : faRightFromBracket} size={13} spin={pending} />
      Sign out other devices
    </button>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [state, action, pending] = useActionState(changePasswordAction, null);

  useEffect(() => {
    if (state?.ok) {
      toast({ message: state.message ?? "Password changed" });
      onClose();
    }
  }, [state, toast, onClose]);

  const e = state?.fieldErrors;
  return (
    <Modal open={open} onClose={onClose} width={520} icon={faKey} title="Change password" subtitle="You’ll stay signed in here. Other devices are signed out.">
      <form action={action} noValidate className="flex flex-col gap-[18px]">
        {state?.message && !state.ok ? (
          <p role="alert" className="rounded-[10px] bg-danger-subtle px-3.5 py-3 text-[12px] text-[#7f1d1d]">
            {state.message}
          </p>
        ) : null}
        <Field label="Current password" htmlFor="cp-current" error={e?.currentPassword}>
          <Input id="cp-current" name="currentPassword" type="password" autoComplete="current-password" required aria-invalid={!!e?.currentPassword} />
        </Field>
        <Field label="New password" htmlFor="cp-new" error={e?.password} hint="At least 12 characters.">
          <Input id="cp-new" name="password" type="password" autoComplete="new-password" required minLength={12} aria-invalid={!!e?.password} />
        </Field>
        <Field label="Confirm new password" htmlFor="cp-confirm" error={e?.confirmPassword}>
          <Input id="cp-confirm" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={!!e?.confirmPassword} />
        </Field>
        <div className="flex gap-3 pt-1.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon={pending ? faSpinner : faCheck} disabled={pending} className="ml-auto">
            {pending ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
