import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { listNotes } from "@/lib/notes/queries";
import { requireCompany } from "../data";
import { NotesEditor } from "./notes-editor";

export const metadata: Metadata = { title: "Notes" };

export default async function CompanyNotesPage({ params }: PageProps<"/new-companies/[number]/notes">) {
  const { number } = await params;
  const [c, user] = await Promise.all([requireCompany(number), requireUser()]);
  const notes = await listNotes(c.id, user);
  return (
    <div className="grid grid-cols-1 [&>*]:min-w-0 items-start gap-4 xl:grid-cols-[1100fr_460fr]">
      <NotesEditor companyNumber={c.number} notes={notes} />
      <Card padding="p-6">
        <CardHeader title="About notes" size="md" />
        <p className="mt-3 text-[12px] leading-4 text-muted">
          Notes are visible to your team only and never printed. Use them to hold a letter, record a call or flag an existing client. You can
          edit or delete your own notes.
        </p>
      </Card>
    </div>
  );
}
