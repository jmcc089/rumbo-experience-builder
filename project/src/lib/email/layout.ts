// Rumbo · SBI-08: shared brand HTML shell for transactional emails.
// Table-based, inline-styled — robust across email clients, not clever.

const COBALT = "#0F47AF";
const NAVY_INK = "#1E2A44";
const OFF_WHITE = "#FBFCFE";
const GOLD = "#E0A44A";
const GOLD_TEXT = "#3a2a08";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

export function renderLayout(opts: { headline: string; bodyHtml: string; ctaHtml?: string }): string {
  const { headline, bodyHtml, ctaHtml } = opts;
  return `<!doctype html>
<html>
  <body style="margin:0; padding:0; background-color:${OFF_WHITE}; font-family:${SANS};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${OFF_WHITE};">
      <tr>
        <td align="center" style="padding:24px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:${OFF_WHITE};">
            <tr>
              <td align="center" style="background-color:${COBALT}; padding:24px; border-radius:4px 4px 0 0;">
                <span style="font-family:${SERIF}; font-size:24px; color:#ffffff; letter-spacing:0.5px;">
                  Rumbo<span style="color:${GOLD};">.</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; padding:32px 28px; border-radius:0 0 4px 4px;">
                <h1 style="font-family:${SERIF}; font-size:22px; color:${NAVY_INK}; margin:0 0 16px 0; font-weight:normal;">
                  ${headline}
                </h1>
                <div style="font-family:${SANS}; font-size:15px; line-height:1.6; color:${NAVY_INK};">
                  ${bodyHtml}
                </div>
                ${ctaHtml ?? ""}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:20px 8px; font-family:${SANS}; font-size:12px; color:${NAVY_INK};">
                Rumbo &middot; boutique travel, El Salvador
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderCtaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td align="center" style="background-color:${GOLD}; border-radius:4px;">
        <a href="${href}" style="display:inline-block; padding:14px 28px; font-family:${SANS}; font-size:15px; font-weight:bold; color:${GOLD_TEXT}; text-decoration:none;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}
