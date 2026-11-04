"use client";

import Link from "next/link";
import { useActionState } from "react";
import { faKey } from "@fortawesome/free-solid-svg-icons";
import { resetPasswordAction } from "@/lib/auth/actions";
import { BackToSignIn, FormMessage, PasswordField, SubmitButton } from "../_components/auth-ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  const e = state?.fieldErrors;

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      {state?.message ? (
        <FormMessage>
          {state.message}{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
        </FormMessage>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        error={e?.password}
        hint="At least 12 characters. You'll be signed out on every other device."
      />
      <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" error={e?.confirmPassword} />
      <SubmitButton icon={faKey} pendingLabel="Saving…">
        Set new password
      </SubmitButton>
      <BackToSignIn />
    </form>
  );
}
