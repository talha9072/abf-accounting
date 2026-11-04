"use client";

import Link from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { faChevronLeft, faEye, faEyeSlash, faSpinner, type IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "@/components/ui/icon";
import { Field, Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function AuthHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[28px] font-bold leading-[38px] text-ink">{title}</h1>
      {children ? <p className="text-[14px] leading-[19px] text-muted">{children}</p> : null}
    </div>
  );
}

export function SubmitButton({ icon, children, pendingLabel }: { icon: IconDefinition; children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClasses({ block: true })}>
      <Icon icon={pending ? faSpinner : icon} size={13} spin={pending} />
      {pending ? pendingLabel : children}
    </button>
  );
}

export function AuthField({
  label,
  name,
  error,
  hint,
  ...input
}: { label: string; name: string; error?: string[]; hint?: ReactNode } & ComponentProps<"input">) {
  const id = `f-${name}`;
  return (
    <Field label={label} htmlFor={id} size="lg" error={error} hint={hint}>
      <Input
        id={id}
        name={name}
        inputSize="lg"
        aria-invalid={error?.length ? true : undefined}
        aria-describedby={error?.length ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...input}
      />
    </Field>
  );
}

export function PasswordField({
  label,
  name,
  error,
  hint,
  autoComplete,
  extra,
}: {
  label: string;
  name: string;
  error?: string[];
  hint?: ReactNode;
  autoComplete: "current-password" | "new-password";
  extra?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  const id = `f-${name}`;
  return (
    <Field label={label} htmlFor={id} size="lg" error={error} hint={hint} labelExtra={extra}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          inputSize="lg"
          autoComplete={autoComplete}
          required
          maxLength={256}
          placeholder="••••••••••"
          className="pr-12"
          aria-invalid={error?.length ? true : undefined}
          aria-describedby={error?.length ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition-colors hover:bg-n100 hover:text-ink"
        >
          <Icon icon={show ? faEyeSlash : faEye} size={14} />
        </button>
      </div>
    </Field>
  );
}

export function BackToSignIn() {
  return (
    <Link href="/sign-in" className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium leading-[18px] text-brand hover:underline">
      <Icon icon={faChevronLeft} size={9} />
      Back to sign in
    </Link>
  );
}

export function FormMessage({ tone = "danger", children }: { tone?: "danger" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-[10px] px-3.5 py-3 text-[13px] leading-[18px]",
        tone === "danger" ? "bg-danger-subtle text-[#7f1d1d]" : "bg-mint text-ink",
      )}
    >
      {children}
    </div>
  );
}
