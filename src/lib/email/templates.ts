// Rumbo · SBI-08: the 3 transactional email templates.
import { getAppBaseUrl } from "./client";
import { EMAIL_TOKENS as T, renderCtaButton, renderLayout } from "./layout";

export interface EmailContent {
  subject: string;
  html: string;
}

export interface OrderSummaryDay {
  day_index: number;
  zone_name: string;
  lodging_name: string;
  experience_names: string[];
}

export interface OrderSummary {
  days: OrderSummaryDay[];
  client_total: number;
}

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Email 1 — plain acknowledgment. No link, no action. Confirms the intake was received. */
export function acknowledgmentEmail(): EmailContent {
  const step = (label: string) => `
    <tr>
      <td width="22" valign="top" style="padding:5px 0;">
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background-color:${T.GOLD};"></span>
      </td>
      <td style="font-family:${T.SANS}; font-size:14px; line-height:1.5; color:${T.NAVY_INK}; padding-bottom:4px;">${label}</td>
    </tr>`;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Thank you for reaching out to Rumbo. Your request is in, and we've already started shaping your trip.</p>
    <p style="margin:0 0 14px 0; font-family:${T.SANS}; font-size:12px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:${T.MUTED};">What happens next</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px 0;">
      ${step("We match you with providers across El Salvador and confirm their availability.")}
      ${step("Our engine assembles three complete, distinct itineraries around what you told us.")}
      ${step("We email you the moment your options are ready to review.")}
    </table>
    <p style="margin:0;">No action is needed from you right now &mdash; sit tight, we'll be in touch shortly.</p>
  `;
  return {
    subject: "We received your request — Rumbo is on it",
    html: renderLayout({
      preheader: "We're matching providers and building your three itineraries now.",
      eyebrow: "Request received",
      headline: "Your trip is underway",
      bodyHtml,
    }),
  };
}

/** Email 2 — the reengagement. Carries the link to the 3 proposals. */
export function proposalsReadyEmail(token: string): EmailContent {
  const link = `${getAppBaseUrl()}/proposals/${token}`;
  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Good news &mdash; your trip is ready.</p>
    <p style="margin:0 0 4px 0;">We've put together <strong>three complete itineraries</strong>, each shaped around what you told us:
    the pace you wanted, the things you're drawn to, and how you like to travel. Take a look, compare them side by side,
    and book the one that feels right.</p>
    ${renderCtaButton("View my itineraries", link)}
    <p style="margin:14px 0 0 0; font-family:${T.SANS}; font-size:13px; line-height:1.5; color:${T.MUTED};">
      Your options are held for 15 minutes once you open them, so you can decide without anyone else claiming your spots.
    </p>
  `;
  return {
    subject: "Your Rumbo itineraries are ready",
    html: renderLayout({
      preheader: "Three complete itineraries, shaped around your trip. Open to compare and book.",
      eyebrow: "Your itineraries are ready",
      headline: "Three ways to see El Salvador",
      bodyHtml,
    }),
  };
}

/** One day of the confirmed itinerary, rendered as an on-brand card. */
function renderDayCard(day: OrderSummaryDay): string {
  const experiencesHtml = day.experience_names.length
    ? day.experience_names
        .map(
          (name) => `
        <tr>
          <td width="18" valign="top" style="padding:4px 0;">
            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background-color:${T.GOLD};"></span>
          </td>
          <td style="font-family:${T.SANS}; font-size:14px; line-height:1.5; color:${T.NAVY_INK};">${name}</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="2" style="font-family:${T.SANS}; font-size:14px; line-height:1.5; color:${T.MUTED}; font-style:italic;">A free day to explore at your own pace.</td></tr>`;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px; background-color:${T.PALE}; border-radius:8px;">
    <tr>
      <td style="padding:18px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${T.SANS}; font-size:11px; font-weight:bold; letter-spacing:1.4px; text-transform:uppercase; color:#ffffff; background-color:${T.COBALT}; border-radius:4px; padding:5px 10px;">Day ${day.day_index}</td>
            <td style="padding-left:12px; font-family:${T.SERIF}; font-size:19px; color:${T.NAVY_INK};">${day.zone_name}</td>
          </tr>
        </table>
        <p style="margin:15px 0 12px 0; font-family:${T.SANS}; font-size:11px; letter-spacing:0.8px; text-transform:uppercase; color:${T.MUTED};">Stay &middot; <span style="font-size:14px; letter-spacing:0; text-transform:none; color:${T.NAVY_INK};">${day.lodging_name}</span></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${experiencesHtml}</table>
      </td>
    </tr>
  </table>`;
}

/** Email 3 — purchase confirmation / receipt. */
export function purchaseConfirmationEmail(order: OrderSummary): EmailContent {
  const zones = order.days.map((d) => d.zone_name);
  const uniqueZones = Array.from(new Set(zones));
  const routeLabel =
    uniqueZones.length > 1 ? `${uniqueZones[0]} → ${uniqueZones[uniqueZones.length - 1]}` : uniqueZones[0] ?? "";
  const summaryLine = `${order.days.length} ${order.days.length === 1 ? "day" : "days"} · ${uniqueZones.length} ${uniqueZones.length === 1 ? "region" : "regions"} · ${routeLabel}`;

  const daysHtml = order.days.map(renderDayCard).join("");

  const bodyHtml = `
    <p style="margin:0 0 22px 0;">You're all set &mdash; your trip is booked. Here's everything you'll be doing, day by day.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td style="font-family:${T.SANS}; font-size:13px; letter-spacing:0.3px; color:${T.MUTED};">${summaryLine}</td>
      </tr>
    </table>

    ${daysHtml}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0; background-color:#fbf3e6; border:1px solid ${T.GOLD}; border-radius:8px;">
      <tr>
        <td style="padding:18px 22px; font-family:${T.SANS}; font-size:13px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; color:${T.GOLD_TEXT};">Total paid</td>
        <td align="right" style="padding:18px 22px; font-family:${T.SERIF}; font-size:26px; color:${T.NAVY_INK};">${formatUsd(order.client_total)}</td>
      </tr>
    </table>

    <p style="margin:22px 0 0 0;">We're excited to have you travel with us. If anything about your trip changes on our end, we'll be in touch right away.</p>
  `;
  return {
    subject: "Your Rumbo trip is confirmed",
    html: renderLayout({
      preheader: `Booked: ${summaryLine}. Total ${formatUsd(order.client_total)}.`,
      eyebrow: "Booking confirmed",
      headline: "You're going to El Salvador",
      bodyHtml,
    }),
  };
}
