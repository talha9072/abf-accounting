"use client";

import { useActionState } from "react";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { AuthField, AuthHeading, BackToSignIn, SubmitButton } from "../_components/auth-ui";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, null);

  if (state?.ok) {
    return (
      <>
        <AuthHeading title="Check your email">
          If {state.values?.email} has an ABF account, a reset link is on its way. It expires in 30 minutes.
        </AuthHeading>
        <form action={action} className="flex flex-col gap-5">
          <input type="hidden" name="email" value={state.values?.email ?? ""} />
          <SubmitButton icon={faPaperPlane} pendingLabel="Sending…">
            Resend link
          </SubmitButton>
          <BackToSignIn />
        </form>
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Reset your password">
        Enter your work email and we&rsquo;ll send a reset link that works for 30 minutes.
      </AuthHeading>
      <form action={action} noValidate className="flex flex-col gap-5">
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
        <SubmitButton icon={faPaperPlane} pendingLabel="Sending…">
          Send reset link
        </SubmitButton>
        <BackToSignIn />
      </form>
    </>
  );
}
