import "server-only";
import { cache } from "react";
import { getTemplateDetail } from "@/lib/templates/queries";

/** One DB read per request, shared by the layout and the tab pages. */
export const loadTemplate = cache(getTemplateDetail);
