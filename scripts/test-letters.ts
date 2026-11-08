/**
 * Checks for template sanitising and ##CODE# merging.
 *   npx tsx scripts/test-letters.ts
 */
import assert from "node:assert/strict";
import { sanitizeTemplateHtml } from "../src/lib/letters/html";
import { mergeCodes, mergeGreeting, type MergeValues } from "../src/lib/letters/merge";

const s = sanitizeTemplateHtml;

// Allowed formatting survives, attributes are stripped.
assert.equal(s('<p class="x" style="color:red">Hi <strong onclick="alert(1)">there</strong></p>'), "<p>Hi <strong>there</strong></p>");
// Scripts, iframes, svg and event handlers are removed.
assert.equal(s("<p>a</p><script>alert(1)</script><p>b</p>"), "<p>a</p><p>b</p>");
assert.equal(s('<img src=x onerror="alert(1)"><p>ok</p>'), "<p>ok</p>");
assert.equal(s('<svg onload="alert(1)"><circle/></svg>x'), "x");
assert.equal(s('<a href="javascript:alert(1)">link</a>'), "link");
assert.equal(s("<iframe src=//evil></iframe>"), "");
// Unclosed / broken markup can't sneak in.
assert.equal(s("<p>2 < 3 and <img src=x onerror=alert(1)"), "<p>2 &lt; 3 and &lt;img src=x onerror=alert(1)");
// contentEditable <div>s become paragraphs; empty paragraphs vanish.
assert.equal(s("<div>One</div><div><br></div><div>Two</div>"), "<p>One</p><p>Two</p>");

const values: MergeValues = {
  COMPANY_NAME: `Tom & Jerry <script>alert(1)</script> Ltd`,
  DIRECTOR_FIRSTNAME: "",
  DIRECTOR_FULLNAME: "",
  REGISTERED_ADDRESS: "1 High St, Luton, LU1 1AA",
  COMPANY_NUMBER: "12345678",
  INCORPORATION_DATE: "4 November 2026",
  REFERENCE: "ABF-12345678",
  OFFER: "Business Starter from £65",
  LETTER_DATE: "8 November 2026",
  BRAND_NAME: "ABF Accounting Services Ltd",
  BRAND_SUPPORT_TELEPHONE: "+44 7405 141694",
  BRAND_SUPPORT_EMAIL: "support@abfaccounting.com",
};

// Company names from Companies House are escaped.
assert.equal(
  mergeCodes("<p>Congratulations ##COMPANY_NAME#</p>", values),
  "<p>Congratulations Tom &amp; Jerry &lt;script&gt;alert(1)&lt;/script&gt; Ltd</p>",
);
// Layout codes are removed, unknown codes stay visible for the preview.
assert.equal(mergeCodes("##LETTER_HEAD#<p>x ##NOT_A_CODE#</p>##LETTER_FOOTER#", values), "<p>x ##NOT_A_CODE#</p>");
// Greeting fallback when Companies House has no director name.
assert.equal(mergeGreeting("Dear ##DIRECTOR_FIRSTNAME#,", values), "To whom it may concern,");
assert.equal(mergeGreeting("Dear ##DIRECTOR_FIRSTNAME#,", { ...values, DIRECTOR_FIRSTNAME: "Sarah" }), "Dear Sarah,");

console.log("letters: sanitising + merging checks passed");
