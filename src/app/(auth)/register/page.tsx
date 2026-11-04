import type { Metadata } from "next";
import { AuthHeading } from "../_components/auth-ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <>
      <AuthHeading title="Create your account">Use your ABF work email. Your name appears in activity logs and notes.</AuthHeading>
      <RegisterForm />
    </>
  );
}
