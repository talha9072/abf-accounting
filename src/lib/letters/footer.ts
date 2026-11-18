/**
 * The "exclude" footer printed at the bottom of every letter. One source for the printed letter
 * (components/admin/printed-letter.tsx) and the read-only copy on Letter Templates → Settings.
 * Plain text — React escapes it wherever it's shown.
 */
type FooterBusiness = { email: string; phone: string; web: string; registration: string };

export function letterFooterLines(business: FooterBusiness, reference: string): string[] {
  return [
    `Don’t want letters from us? Email ${business.email} or call ${business.phone}, quote ${reference} and we’ll stop. We found your company on the public Companies House register — see ${business.web}/privacy for how we use this information.`,
    business.registration,
  ];
}
