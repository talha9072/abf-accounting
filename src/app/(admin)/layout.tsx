import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";
import { ToastProvider } from "@/components/ui/toast";
import { requireUser } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const name = `${user.firstName} ${user.lastName}`.trim();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar user={{ name, email: user.email, initials }} />
          <main id="main" className="flex flex-1 flex-col gap-[18px] px-9 pb-[30px] pt-7">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
