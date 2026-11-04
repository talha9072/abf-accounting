import type { Metadata } from "next";
import { AuthHeading, BackToSignIn, FormMessage } from "../_components/auth-ui";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && token.length >= 20 && token.length <= 200;

  return (
    <>
      <AuthHeading title="Choose a new password">Pick a password you don&rsquo;t use anywhere else.</AuthHeading>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-5">
          <FormMessage>This reset link isn&rsquo;t valid. Request a new one from the sign-in page.</FormMessage>
          <BackToSignIn />
        </div>
      )}
    </>
  );
}
