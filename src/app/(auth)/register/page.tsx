import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthHeading, BackToSignIn } from "../_components/auth-ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage() {
  // Read the switch per request (not at build time). registerAction checks it again on submit.
  await connection();
  if (process.env.REGISTRATION_ENABLED === "false") {
    return (
      <>
        <AuthHeading title="Accounts are created by your admin">
          Sign-up is closed for ABF New Companies. Ask your admin to create an account for you, then sign in with the details they send.
        </AuthHeading>
        <BackToSignIn />
      </>
    );
  }

  return (
    <>
      <AuthHeading title="Create your account">Use your ABF work email. Your name appears in activity logs and notes.</AuthHeading>
      <RegisterForm />
    </>
  );
}
