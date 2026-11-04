import { redirect } from "next/navigation";
import { templates } from "@/lib/mock-data";

export default function LetterTemplatesIndex() {
  redirect(`/letter-templates/${templates[0].id}`);
}
