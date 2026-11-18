import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getChallenge } from "@/lib/auth/two-factor";
import { AuthHeading } from "../../_components/auth-ui";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function VerifyPage() {
  // Only reachable straight after a correct password.
  const challenge = await getChallenge();
  if (!challenge) redirect("/sign-in");

  return (
    <>
      <AuthHeading title="Enter your sign-in code">
        Open your authenticator app and type the 6-digit code for ABF New Companies ({challenge.email}).
      </AuthHeading>
      <VerifyForm />
    </>
  );
}
