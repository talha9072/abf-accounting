import type { Metadata } from "next";
import { safeNextPath } from "@/lib/auth/validation";
import { AuthHeading } from "../_components/auth-ui";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : undefined;
  const next = rawNext ? safeNextPath(rawNext) : undefined;
  const notice = sp.reset === "1" ? "Your password has been changed. Sign in with your new password." : undefined;

  return (
    <>
      <AuthHeading title="Sign in to ABF New Companies">Use your work account to sign in.</AuthHeading>
      <SignInForm next={next} notice={notice} />
    </>
  );
}
