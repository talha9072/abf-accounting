"use client";

import Link from "next/link";
import { useActionState } from "react";
import { faRightToBracket } from "@fortawesome/free-solid-svg-icons";
import { signInAction } from "@/lib/auth/actions";
import { AuthField, FormMessage, PasswordField, SubmitButton } from "../_components/auth-ui";

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(signInAction, null);

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {notice && !state ? <FormMessage tone="success">{notice}</FormMessage> : null}
      {state?.message ? <FormMessage>{state.message}</FormMessage> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <AuthField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        placeholder="name@abfaccounting.com"
        required
        maxLength={254}
        defaultValue={state?.values?.email}
        error={state?.fieldErrors?.email}
        autoFocus
      />
      <PasswordField label="Password" name="password" autoComplete="current-password" error={state?.fieldErrors?.password} />

      <div className="flex items-center justify-between gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] leading-[18px] text-muted">
          <input
            type="checkbox"
            name="remember"
            className="size-4 cursor-pointer rounded-[4px] border-line accent-brand"
          />
          Keep me signed in on this computer
        </label>
        <Link href="/forgot-password" className="text-[13px] font-medium leading-[18px] text-brand hover:underline">
          Forgot password?
        </Link>
      </div>

      <SubmitButton icon={faRightToBracket} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>

      <p className="text-center text-[13px] leading-[18px] text-muted">
        New to ABF New Companies?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
