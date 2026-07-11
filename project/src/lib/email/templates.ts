// Rumbo · SBI-08: the 3 transactional email templates.
import { getAppBaseUrl } from "./client";
import { renderCtaButton, renderLayout } from "./layout";

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
  const bodyHtml = `
    <p>Thank you for reaching out to Rumbo.</p>
    <p>We received your request and we're putting your trip together — matching providers, checking
    availability, and shaping your options. We'll email you the moment your itineraries are ready.</p>
    <p>No action is needed from you right now.</p>
  `;
  return {
    subject: "We received your request — Rumbo is on it",
    html: renderLayout({ headline: "Your trip is underway", bodyHtml }),
  };
}

/** Email 2 — the reengagement. Carries the link to the 3 proposals. */
export function proposalsReadyEmail(token: string): EmailContent {
  const link = `${getAppBaseUrl()}/proposals/${token}`;
  const bodyHtml = `
    <p>Good news — your trip is ready.</p>
    <p>We've put together three complete itineraries for you, each shaped around what you told us.
    Take a look, compare them, and book the one that feels right.</p>
  `;
  const ctaHtml = renderCtaButton("View my itineraries", link);
  return {
    subject: "Your Rumbo itineraries are ready",
    html: renderLayout({ headline: "Your options are ready", bodyHtml, ctaHtml }),
  };
}

/** Email 3 — purchase confirmation / receipt. */
export function purchaseConfirmationEmail(order: OrderSummary): EmailContent {
  const daysHtml = order.days
    .map((day) => {
      const experiences = day.experience_names.length
        ? day.experience_names.map((n) => `<li>${n}</li>`).join("")
        : "<li>Free day</li>";
      return `
        <div style="margin-bottom:16px;">
          <p style="margin:0 0 4px 0; font-weight:bold;">Day ${day.day_index} — ${day.zone_name}</p>
          <p style="margin:0 0 4px 0;">Staying at ${day.lodging_name}</p>
          <ul style="margin:4px 0 0 20px; padding:0;">${experiences}</ul>
        </div>
      `;
    })
    .join("");

  const bodyHtml = `
    <p>You're all set — your trip is booked.</p>
    <p>Here's a summary of your itinerary:</p>
    ${daysHtml}
    <p style="margin-top:20px; font-size:16px; font-weight:bold;">Total paid: ${formatUsd(order.client_total)}</p>
    <p>We're excited to have you travel with us. If anything about your trip changes on our end, we'll
    be in touch right away.</p>
  `;
  return {
    subject: "Your Rumbo trip is confirmed",
    html: renderLayout({ headline: "Booking confirmed", bodyHtml }),
  };
}
