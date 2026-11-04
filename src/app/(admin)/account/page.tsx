import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getMyAccount } from "@/lib/account";
import { AccountForms } from "./account-forms";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const account = await getMyAccount();
  return (
    <>
      <PageHeader title="My account" description="Your own details, password and the emails you get." />
      <AccountForms account={account} />
    </>
  );
}
