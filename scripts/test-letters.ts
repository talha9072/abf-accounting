/**
 * Checks for template sanitising and ##CODE# merging.
 *   npx tsx scripts/test-letters.ts
 */
import assert from "node:assert/strict";
import { sanitizeTemplateHtml } from "../src/lib/letters/html";
import { letterRecipient, mergeCodes, mergeGreeting, type MergeValues } from "../src/lib/letters/merge";
import { letterFooterLines } from "../src/lib/letters/footer";

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
// Strikethrough: Chromium's execCommand makes <strike>; <del> means the same. Both become <s>.
assert.equal(s("<p>a <strike>b</strike> <del datetime=x>c</del> <s>d</s></p>"), "<p>a <s>b</s> <s>c</s> <s>d</s></p>");
// Indent: only an exact indent-1…3 class survives on paragraphs — rebuilt, never copied.
assert.equal(s('<div class="indent-2">x</div>'), '<p class="indent-2">x</p>');
assert.equal(s('<p class="foo indent-1 bar" style="margin-left:40px">x</p>'), '<p class="indent-1">x</p>');
assert.equal(s("<p class='indent-3'>x</p><p class=indent-1>y</p>"), '<p class="indent-3">x</p><p class="indent-1">y</p>');
assert.equal(s('<p class="indent-4">x</p><p class="indent-1x">y</p><p data-class="indent-1">z</p>'), "<p>x</p><p>y</p><p>z</p>");
assert.equal(s('<p class="indent-1" onclick="alert(1)">x</p>'), '<p class="indent-1">x</p>');
assert.equal(s('<p class="indent-1&quot; onclick=&quot;alert(1)">x</p>'), "<p>x</p>");
assert.equal(s('<strong class="indent-1">x</strong><blockquote class="indent-2">y</blockquote>'), "<strong>x</strong><blockquote>y</blockquote>");
assert.equal(s('<p class="indent-2"><br></p>'), "");
// The old execCommand("indent") markup loses its inline style (it's a plain quote, not arbitrary CSS).
assert.equal(s('<blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;">x</blockquote>'), "<blockquote>x</blockquote>");

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
// Name line / label when only corporate officers exist: LLPs (OC/SO/NC) have members, not directors.
assert.equal(letterRecipient("Sarah Ahmed", "OC462050"), "Sarah Ahmed");
assert.equal(letterRecipient(null, "OC462050"), "The Members");
assert.equal(letterRecipient("  ", "SO305123"), "The Members");
assert.equal(letterRecipient(undefined, "NC001234"), "The Members");
assert.equal(letterRecipient(null, "16012345"), "The Director");
assert.equal(letterRecipient(null, "SC812345"), "The Director");

// The exclude footer (printed letter + Settings tab share it) carries the contact details, reference and privacy line.
const footer = letterFooterLines({ email: "support@x.com", phone: "+44 1", web: "x.com", registration: "Reg line" }, "ABF-1");
assert.equal(footer.length, 2);
assert.ok(footer[0].includes("Email support@x.com or call +44 1, quote ABF-1 and we’ll stop."));
assert.ok(footer[0].includes("see x.com/privacy"));
assert.equal(footer[1], "Reg line");

console.log("letters: sanitising + merging + footer checks passed");
