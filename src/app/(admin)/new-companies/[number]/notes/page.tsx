import type { Metadata } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { NotesEditor } from "./notes-editor";

export const metadata: Metadata = { title: "Notes" };

export default function CompanyNotesPage() {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1100fr_460fr]">
      <NotesEditor />
      <Card padding="p-6">
        <CardHeader title="About notes" size="md" />
        <p className="mt-3 text-[12px] leading-4 text-muted">
          Notes are visible to your team only and never printed. Use them to hold a letter, record a call or flag an existing client.
        </p>
      </Card>
    </div>
  );
}
