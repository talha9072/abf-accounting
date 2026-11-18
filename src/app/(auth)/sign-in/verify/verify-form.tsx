"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { faShieldHalved } from "@fortawesome/free-solid-svg-icons";
import { verifyTwoFactorAction } from "@/lib/auth/actions";
import { AuthField, BackToSignIn, FormMessage, SubmitButton } from "../../_components/auth-ui";

export function VerifyForm() {
  const [state, action] = useActionState(verifyTwoFactorAction, null);
  const [recovery, setRecovery] = useState(false);

  if (state?.values?.expired) {
    return (
      <div className="flex flex-col gap-5">
        <FormMessage>{state.message}</FormMessage>
        <Link href="/sign-in" className="text-[13px] font-medium leading-[18px] text-brand hover:underline">
          Sign in again
        </Link>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state?.message ? <FormMessage>{state.message}</FormMessage> : null}

      {recovery ? (
        <AuthField
          key="recovery"
          label="Recovery code"
          name="code"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="xxxx-xxxx"
          maxLength={32}
          hint="One of the codes you saved when you turned on two-step sign-in. Each code works once."
          error={state?.fieldErrors?.code}
          autoFocus
        />
      ) : (
        <AuthField
          key="totp"
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          placeholder="123 456"
          maxLength={7}
          className="tracking-[0.3em]"
          error={state?.fieldErrors?.code}
          autoFocus
        />
      )}

      <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] leading-[18px] text-muted">
        <input type="checkbox" name="trust" className="size-4 cursor-pointer rounded-[4px] border-line accent-brand" />
        Don’t ask for a code on this computer for 30 days
      </label>

      <SubmitButton icon={faShieldHalved} pendingLabel="Checking…">
        Verify and sign in
      </SubmitButton>

      <div className="flex items-center justify-between gap-4">
        <BackToSignIn />
        <button
          type="button"
          onClick={() => setRecovery((r) => !r)}
          className="text-[13px] font-medium leading-[18px] text-brand hover:underline"
        >
          {recovery ? "Use my authenticator app" : "Use a recovery code"}
        </button>
      </div>
    </form>
  );
}
