import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-6 text-center">
      <Logo width={150} />
      <h1 className="mt-4 text-[28px] font-bold leading-[38px] text-ink">We can’t find that page</h1>
      <p className="max-w-md text-[14px] leading-5 text-muted">
        The link may be old, or the company or template may have been removed.
      </p>
      <ButtonLink href="/new-companies" icon={faArrowLeft}>
        Back to New Companies
      </ButtonLink>
    </main>
  );
}
