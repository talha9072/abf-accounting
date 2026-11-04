import { Logo } from "@/components/brand/logo";
import { redirectIfSignedIn } from "@/lib/auth/dal";

/**
 * Split sign-in layout — white form panel (1100/1920) + dark brand panel (820/1920).
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  await redirectIfSignedIn();

  return (
    <div className="flex min-h-screen bg-white">
      <main className="flex flex-1 items-center justify-center px-6 py-16 lg:basis-[57.3%]">
        <div className="flex w-full max-w-[420px] flex-col gap-5">
          <Logo width={177} />
          {children}
        </div>
      </main>

      <aside
        aria-hidden
        className="hidden basis-[42.7%] flex-col justify-center gap-5 bg-ink px-12 lg:flex xl:px-24"
      >
        <p className="text-[13px] font-medium uppercase leading-[18px] text-brand">Internal tool</p>
        <p className="max-w-[628px] text-[40px] font-bold leading-[1.375] text-white xl:text-[48px]">
          New companies, every morning.
        </p>
        <p className="max-w-[628px] text-[18px] leading-[25px] text-white/80">
          New Companies House incorporations are pulled at 06:00 — anything missed on a failed day or weekend is caught up
          automatically. Pick who gets a letter, print, and post.
        </p>
      </aside>
    </div>
  );
}
