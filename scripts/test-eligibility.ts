/**
 * Quick checks for the selection rules and director-name parsing.
 *   npx tsx scripts/test-eligibility.ts
 */
import assert from "node:assert/strict";
import { addressKey, evaluate, formatPostcode, isCic, pickDirector, toAddress, type RuleContext } from "../src/lib/pull/eligibility";

const ctx: RuleContext = {
  ownOffice: { line1: "18 Thricknells Close", postcode: "LU3 3RP" },
  sharedCounts: new Map([[addressKey({ line1: "71-75 Shelton Street", postcode: "WC2H 9JQ" }), 203]]),
  // Virtual office: every company gets its own "Office NNNN", only the postcode repeats.
  sharedPostcodes: new Map([["WV60SR", 15]]),
  excludedNumbers: new Set(["11111111"]),
  excludedNames: new Set(["NORTH & CO LTD"]),
  printedNumbers: new Set(["22222222"]),
};
const base = { companyNumber: "17560782", name: "FIFTEEN ELEVEN HOLDINGS LIMITED", companyType: "ltd" };
const good = toAddress({ address_line_1: "6 High Oaks Close", locality: "Coulsdon", postal_code: "CR5 3EZ" });

let r = evaluate({ ...base, address: good }, ctx);
assert.equal(r.state, "not_reviewed");
assert.equal(Object.values(r.eligibility).every(Boolean), true);

r = evaluate({ ...base, companyType: "plc", address: good }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "company_type"]);

// Ashley, 20 Nov 2026: companies limited by guarantee get a letter, CICs never do.
r = evaluate({ ...base, name: "GREEN HOUSE TRUST LIMITED", companyType: "private-limited-guarant-nsc", address: good }, ctx);
assert.equal(r.state, "not_reviewed");
r = evaluate({ ...base, name: "OLD SCHOOL ASSOCIATION", companyType: "private-limited-guarant-nsc-limited-exemption", address: good }, ctx);
assert.equal(r.state, "not_reviewed");
r = evaluate({ ...base, name: "EDGE IMPACT CIC", companyType: "private-limited-guarant-nsc", companySubtype: "community-interest-company", address: good }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "company_type"]);
r = evaluate({ ...base, name: "FOXGLOVE MEADOWS COMMUNITY CIC", companyType: "ltd", companySubtype: "community-interest-company", address: good }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "company_type"], "a CIC limited by shares is still a CIC");
r = evaluate({ ...base, name: "RIVERSIDE ARTS C.I.C.", companyType: "ltd", address: good }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "company_type"], "CIC by name when the subtype is missing");
for (const n of ["NORTHERN LIGHTS COMMUNITY INTEREST COMPANY", "Y GEGIN CBC", "Menter Iaith Cwmni Buddiant Cymunedol", "ABC CIC"]) assert.ok(isCic({ name: n }), n);
for (const n of ["MAGIC LTD", "ARCTIC SOLUTIONS LIMITED", "CIC HOLDINGS LTD", "PUBLIC LTD"]) assert.ok(!isCic({ name: n }), n);

r = evaluate({ ...base, address: toAddress({ address_line_1: "71-75, Shelton Street", locality: "London", postal_code: "wc2h 9jq" }) }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "not_shared_address"]);

r = evaluate({ ...base, address: toAddress({ address_line_1: "Office 2334 85 Dunstall Hill", locality: "Wolverhampton", postal_code: "WV60SR" }) }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "not_shared_address"]);

r = evaluate({ ...base, address: toAddress({ address_line_1: "18 Thricknells Close", locality: "Luton", postal_code: "LU3 3RP" }) }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "not_own_office"]);

r = evaluate({ ...base, address: toAddress({ address_line_1: "PO Box 4385", locality: "Cardiff", postal_code: "CF14 8LH" }) }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "not_ch_default"]);

r = evaluate({ ...base, address: toAddress({ address_line_1: "4 Rose Street", locality: "Edinburgh" }) }, ctx);
assert.deepEqual([r.state, r.skipReason], ["address_issue", "address_complete"]);

r = evaluate({ ...base, companyNumber: "11111111", address: good }, ctx);
assert.deepEqual([r.state, r.skipReason], ["excluded", "not_excluded"]);
r = evaluate({ ...base, name: "North & Co Ltd", address: good }, ctx);
assert.equal(r.state, "excluded");

r = evaluate({ ...base, companyNumber: "22222222", address: good }, ctx);
assert.deepEqual([r.state, r.skipReason], ["skipped", "not_printed_before"]);

assert.deepEqual(pickDirector([{ name: "GRIFFITHS, Danielle Christina Constance", officer_role: "director", appointed_on: "2026-11-04" }]), {
  firstName: "Danielle",
  fullName: "Danielle Griffiths",
});
assert.deepEqual(
  pickDirector([
    { name: "SMITH, John", officer_role: "director", appointed_on: "2026-11-01", resigned_on: "2026-11-02" },
    { name: "ACME SECRETARIES LTD", officer_role: "corporate-secretary" },
    { name: "MCDONALD, Dr Sarah-Jane", officer_role: "director", appointed_on: "2026-11-03" },
  ]),
  { firstName: "Sarah-Jane", fullName: "Sarah-Jane McDonald" },
);
assert.equal(pickDirector([{ name: "ACME DIRECTORS LTD", officer_role: "corporate-director" }]), null);
// Postcodes from Companies House with odd spacing are tidied, so the address isn't flagged.
assert.equal(formatPostcode("GU10 1 FJ"), "GU10 1FJ");
assert.equal(formatPostcode("gu101fj"), "GU10 1FJ");
assert.equal(formatPostcode(" EH2  2QA "), "EH2 2QA");
assert.equal(formatPostcode(""), null);
assert.equal(formatPostcode("NOT A CODE"), "NOT A CODE");
assert.equal(toAddress({ address_line_1: "42 Yalden Gardens", locality: "Farnham", postal_code: "GU10 1 FJ" }).postcode, "GU10 1FJ");

// LLPs: members instead of directors; designated members first, corporate members never.
assert.deepEqual(
  pickDirector([
    { name: "HOLDCO LLP", officer_role: "corporate-llp-designated-member", appointed_on: "2026-11-01" },
    { name: "KHAN, Ayesha", officer_role: "llp-member", appointed_on: "2026-11-01" },
    { name: "PATEL, Ravi Kumar", officer_role: "llp-designated-member", appointed_on: "2026-11-02" },
  ]),
  { firstName: "Ravi", fullName: "Ravi Patel" },
);
// A real director still wins over an LLP role.
assert.equal(
  pickDirector([
    { name: "KHAN, Ayesha", officer_role: "llp-designated-member", appointed_on: "2026-11-01" },
    { name: "JONES, Tom", officer_role: "director", appointed_on: "2026-11-05" },
  ])?.firstName,
  "Tom",
);

console.log("eligibility + director parsing: all checks passed");
