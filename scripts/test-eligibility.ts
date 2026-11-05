/**
 * Quick checks for the selection rules and director-name parsing.
 *   npx tsx scripts/test-eligibility.ts
 */
import assert from "node:assert/strict";
import { addressKey, evaluate, pickDirector, toAddress, type RuleContext } from "../src/lib/pull/eligibility";

const ctx: RuleContext = {
  ownOffice: { line1: "18 Thricknells Close", postcode: "LU3 3RP" },
  sharedCounts: new Map([[addressKey({ line1: "71-75 Shelton Street", postcode: "WC2H 9JQ" }), 203]]),
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

r = evaluate({ ...base, address: toAddress({ address_line_1: "71-75, Shelton Street", locality: "London", postal_code: "wc2h 9jq" }) }, ctx);
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

console.log("eligibility + director parsing: all checks passed");
