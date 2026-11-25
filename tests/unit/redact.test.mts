import { redact } from "../../src/lib/kindling/redact.ts";
const cases = [
  ["card 4111 1111 1111 1111 thanks", "[CARD REMOVED]"],
  ["order 1234 5678 9012 3456 (fails luhn)", "1234 5678 9012 3456"],
  ["email me at maria.k@shop.co.uk", "[EMAIL]"],
  ["call 0803 123 4567 or 08031234567", "[PHONE]"],
  ["call +234 803 123 4567", "[PHONE]"],
  ["call 0803 123 4567 now", "call [PHONE] now"],
  ["call 0803-123-4567 now", "call [PHONE] now"],
  ["call +2348031234567", "call [PHONE]"],
  ["call (415) 555-2671", "[PHONE]"],
  ["BVN 12345678901 please", "[ID REMOVED]"],
  ["ssn 123-45-6789", "[ID REMOVED]"],
  ["my password is hunter22", "[SECRET REMOVED]"],
  ["account number: 0123456789", "[ACCOUNT REMOVED]"],
  ["3 trays on Saturday for $1,200 at 2pm", "3 trays on Saturday for $1,200 at 2pm"],
  ["we need 1 200 000 naira and 250 000", "1 200 000"],
  ["pinned the post, pin is 4821", "[SECRET REMOVED]"],
];
let bad = 0;
for (const [input, expect] of cases) {
  const out = redact(input).text;
  const pass = out.includes(expect);
  if (!pass) bad++;
  console.log((pass ? "PASS " : "FAIL ") + JSON.stringify(input) + " -> " + JSON.stringify(out));
}
process.exit(bad ? 1 : 0);
