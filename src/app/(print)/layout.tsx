import { requireUser } from "@/lib/auth/dal";

/** Bare layout for printable documents (no sidebar / top bar). Still signed-in only. */
export default async function PrintLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return <div className="min-h-screen bg-[#e9efeb] print:bg-white">{children}</div>;
}
