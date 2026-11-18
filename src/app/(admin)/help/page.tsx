import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/page-header";

export const metadata: Metadata = { title: "Help & how it works" };

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-4 rounded-2xl border border-line bg-white p-6">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mint text-[13px] font-bold text-brand">{n}</span>
      <div className="flex min-w-0 flex-col gap-2 text-[13px] leading-[20px] text-ink">
        <h2 className="text-[16px] font-bold leading-[22px]">{title}</h2>
        {children}
      </div>
    </section>
  );
}

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="font-medium text-brand hover:underline">
    {children}
  </Link>
);

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help & how it works" description="From a new Companies House incorporation to a letter in the post." />
      <div className="flex max-w-[1032px] flex-col gap-4">
        <Section n={1} title="Every morning: the Companies House pull">
          <p>
            At 06:00 (South Africa time) the app fetches every company incorporated since the last successful pull. Missed days and weekends are
            caught up automatically. If a pull fails it retries every 30 minutes, and anyone who chose “Email me if the morning pull fails” in{" "}
            <A href="/account">My account</A> gets one email.
          </p>
          <p>You can start a pull yourself from the Companies House card at the bottom of the menu → Run pull now.</p>
        </Section>

        <Section n={2} title="Rules: who can get a letter">
          <p>Each new company is checked against these rules. Companies that fail one are skipped and never get a letter:</p>
          <ul className="list-disc pl-5">
            <li>Private limited company (Ltd) or LLP</li>
            <li>A complete UK registered address</li>
            <li>
              Not your own office (set in <A href="/settings">Business settings</A>)
            </li>
            <li>Not a shared or agent address: 5 or more new companies at one address, or 8 or more at one postcode, in 14 days</li>
            <li>Not the Companies House default address</li>
            <li>Not on your excluded list, and never printed before</li>
          </ul>
          <p>Companies with a broken address land in “Address issue”; fix the posting address and they become ready again.</p>
        </Section>

        <Section n={3} title="Choose who gets a letter">
          <p>
            On <A href="/new-companies">New Companies</A>, tick companies and press <b>Add to print run</b>, or <b>Exclude</b> the ones that shouldn’t
            get a letter. Open a company to see its details, activity, letters and notes. Every action can be undone from the message that appears.
          </p>
        </Section>

        <Section n={4} title="Print letters and labels">
          <ol className="list-decimal pl-5">
            <li>
              On <A href="/print">Print</A>, pick the letter template and press <b>Preview</b>.
            </li>
            <li>
              <b>Print N letters</b> creates a print run, marks the companies Printed and opens the letters (A4, one per page). Choose “Save as PDF”
              in the print dialog if you want a file.
            </li>
            <li>
              Answer <b>Did all letters print?</b> — Yes marks them Sent; Not yet lets you print again.
            </li>
            <li>
              <b>Print labels</b>: A4 sheets of 2 × 6 labels (98 × 46 mm), in the same order as the letters. Use “start at label” for a part-used sheet.
            </li>
          </ol>
          <p>
            Paper jam? <A href="/history?tab=print-runs">History → Print runs</A> reprints a whole run or just a range, without changing any dates.
          </p>
        </Section>

        <Section n={5} title="Letter templates">
          <p>
            In <A href="/letter-templates">Letter Templates</A> you edit the letter text with a live preview. Replace codes like ##COMPANY_NAME# are
            filled in for each company. Saving creates a new version; you can view and restore old versions. There is always one active default
            template.
          </p>
        </Section>

        <Section n={6} title="Your account and security">
          <p>
            In <A href="/account">My account</A> you can change your password, sign out other devices and turn on <b>two-step sign-in</b>: after your
            password you type a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy). Keep the
            recovery codes somewhere safe in case you lose your phone.
          </p>
          <p>Five wrong passwords lock the account for 15 minutes. Forgot your password? Use “Forgot password?” on the sign-in page.</p>
        </Section>
      </div>
    </>
  );
}
