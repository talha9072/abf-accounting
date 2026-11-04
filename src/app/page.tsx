import { redirect } from "next/navigation";

// The app opens straight on New Companies (Figma screen map, step 01).
export default function Home() {
  redirect("/new-companies");
}
