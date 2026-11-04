"use client";

import Link from "next/link";
import { useActionState } from "react";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import { registerAction } from "@/lib/auth/actions";
import { AuthField, FormMessage, PasswordField, SubmitButton } from "../_components/auth-ui";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, null);
  const e = state?.fieldErrors;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state?.message ? <FormMessage>{state.message}</FormMessage> : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
        <AuthField
          label="First name"
          name="firstName"
          autoComplete="given-name"
          required
          maxLength={80}
          defaultValue={state?.values?.firstName}
          error={e?.firstName}
          autoFocus
        />
        <AuthField
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          required
          maxLength={80}
          defaultValue={state?.values?.lastName}
          error={e?.lastName}
        />
      </div>

      <AuthField
        label="Work email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="name@abfaccounting.com"
        required
        maxLength={254}
        defaultValue={state?.values?.email}
        error={e?.email}
        hint="Used to sign in and for password resets."
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        error={e?.password}
        hint="At least 12 characters. A short sentence is easy to remember and hard to guess."
      />
      <PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" error={e?.confirmPassword} />

      <SubmitButton icon={faUserPlus} pendingLabel="Creating account…">
        Create account
      </SubmitButton>

      <p className="text-center text-[13px] leading-[18px] text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
