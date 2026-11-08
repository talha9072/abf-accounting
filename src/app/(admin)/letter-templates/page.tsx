import { redirect } from "next/navigation";
import { defaultTemplateId } from "@/lib/templates/queries";

export default async function LetterTemplatesIndex() {
  const id = await defaultTemplateId();
  redirect(id ? `/letter-templates/${id}` : "/print");
}
