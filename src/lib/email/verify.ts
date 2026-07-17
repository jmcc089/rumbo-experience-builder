// Rumbo · SBI-08 verification. Run: npx tsx src/lib/email/verify.ts (from project/)
// Pure template checks — does not require RESEND_API_KEY. sendEmail no-op is exercised too.
import {
  acknowledgmentEmail,
  proposalsReadyEmail,
  purchaseConfirmationEmail,
  sendEmail,
  getAppBaseUrl,
} from "./index";

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${label}`);
  if (!cond) failures++;
}

async function main() {
  // Email 1
  const ack = acknowledgmentEmail();
  check("email1: no link", !ack.html.includes("/proposals/"));
  check("email1: brand header present", ack.html.includes("Rumbo") && ack.html.includes("#0F47AF"));
  check("email1: subject/role is acknowledgment", /received/i.test(ack.subject));

  // Email 2
  const token = "test-token-abc123";
  const proposals = proposalsReadyEmail(token);
  const expectedLink = `${getAppBaseUrl()}/proposals/${token}`;
  check("email2: contains correct proposals link", proposals.html.includes(expectedLink));
  const ctaAnchor = proposals.html.match(/<a[^>]*href="[^"]*proposals[^"]*"[^>]*>/)?.[0] ?? "";
  check(
    "email2: gold CTA uses dark navy text, not white",
    ctaAnchor.includes("color:#3a2a08") || ctaAnchor.includes("color: #3a2a08")
  );
  check("email2: CTA anchor does not use white text", !/color:\s*#fff/i.test(ctaAnchor));
  check("email2: no payment action mentioned", !/pay now|complete payment/i.test(proposals.html));

  // Email 3
  const summary = {
    days: [
      { day_index: 1, zone_name: "La Libertad", lodging_name: "Casa Mar", experience_names: ["Surf lesson"] },
      { day_index: 2, zone_name: "Suchitoto", lodging_name: "Hotel Suchitlán", experience_names: [] },
    ],
    client_total: 1287.5,
  };
  const purchase = purchaseConfirmationEmail(summary);
  check("email3: shows total paid", purchase.html.includes("1,287.50"));
  check("email3: shows day/lodging summary", purchase.html.includes("Casa Mar") && purchase.html.includes("Surf lesson"));
  check("email3: no provider net price / markup terms", !/net_price|net price|markup/i.test(purchase.html));

  // sendEmail no-op path (no RESEND_API_KEY expected in this shell unless set)
  await sendEmail({ to: "test@example.com", subject: "verify no-op", html: "<p>x</p>" });
  check("sendEmail: resolves without throwing", true);

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
