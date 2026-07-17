// Rumbo · SBI-08: shared brand HTML shell for transactional emails.
// Table-based, inline-styled, UTF-8 — robust across email clients, not clever.

const COBALT = "#0F47AF";
const NAVY_INK = "#1E2A44";
const OFF_WHITE = "#FBFCFE";
const PALE = "#E9EEF6";
const PALE_LINE = "#d7e0ee";
const GOLD = "#E0A44A";
const GOLD_DEEP = "#c98d31";
const GOLD_TEXT = "#3a2a08";
const MUTED = "#5b6577";

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// Shared palette + fonts, exported so templates can build on-brand content blocks.
export const EMAIL_TOKENS = {
  COBALT,
  NAVY_INK,
  OFF_WHITE,
  PALE,
  PALE_LINE,
  GOLD,
  GOLD_DEEP,
  GOLD_TEXT,
  MUTED,
  SERIF,
  SANS,
} as const;

export interface LayoutOptions {
  /** Hidden inbox preview text (shown after the subject in the inbox list). */
  preheader?: string;
  /** Small uppercase gold label above the headline. */
  eyebrow?: string;
  headline: string;
  bodyHtml: string;
  ctaHtml?: string;
}

export function renderLayout(opts: LayoutOptions): string {
  const { preheader, eyebrow, headline, bodyHtml, ctaHtml } = opts;

  const preheaderHtml = preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0; color:${OFF_WHITE};">${preheader}</div>`
    : "";

  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 12px 0; font-family:${SANS}; font-size:12px; font-weight:bold; letter-spacing:1.6px; text-transform:uppercase; color:${GOLD_DEEP};">${eyebrow}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${headline}</title>
</head>
<body style="margin:0; padding:0; background-color:${OFF_WHITE}; -webkit-font-smoothing:antialiased;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${OFF_WHITE};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;">
        <!-- Header -->
        <tr>
          <td align="center" style="background-color:${COBALT}; padding:32px 24px 26px 24px; border-radius:10px 10px 0 0;">
            <span style="font-family:${SERIF}; font-size:27px; color:#ffffff; letter-spacing:0.5px;">Rumbo<span style="color:${GOLD};">.</span></span>
            <div style="margin-top:9px; font-family:${SANS}; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; color:#aec4ea;">Boutique travel &middot; El Salvador</div>
          </td>
        </tr>
        <!-- Gold accent rule -->
        <tr>
          <td style="height:4px; line-height:4px; font-size:4px; background-color:${GOLD};">&nbsp;</td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff; padding:40px 36px 36px 36px;">
            ${eyebrowHtml}
            <h1 style="margin:0 0 18px 0; font-family:${SERIF}; font-size:26px; line-height:1.28; font-weight:normal; color:${NAVY_INK};">${headline}</h1>
            <div style="font-family:${SANS}; font-size:15px; line-height:1.65; color:${NAVY_INK};">${bodyHtml}</div>
            ${ctaHtml ?? ""}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:${PALE}; padding:26px 36px; border-radius:0 0 10px 10px; border-top:1px solid ${PALE_LINE};">
            <p style="margin:0 0 6px 0; font-family:${SERIF}; font-size:16px; color:${COBALT};">Rumbo<span style="color:${GOLD_DEEP};">.</span></p>
            <p style="margin:0; font-family:${SANS}; font-size:12px; line-height:1.6; color:${MUTED};">All of El Salvador, none of the planning.<br>A portfolio demonstration &mdash; no real booking or payment is processed.</p>
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 0 0; font-family:${SANS}; font-size:11px; color:${MUTED};">&copy; 2026 Rumbo &middot; San Salvador, El Salvador</p>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function renderCtaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 6px 0;">
    <tr>
      <td align="center" style="background-color:${GOLD}; border-radius:6px; box-shadow:0 1px 0 ${GOLD_DEEP};">
        <a href="${href}" style="display:inline-block; padding:15px 34px; font-family:${SANS}; font-size:15px; font-weight:bold; letter-spacing:0.3px; color:${GOLD_TEXT}; text-decoration:none;">${label} &rarr;</a>
      </td>
    </tr>
  </table>`;
}
