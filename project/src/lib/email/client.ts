// Rumbo · SBI-08: thin wrapper over Resend. Best-effort — never throws.
import { Resend } from "resend";
import fs from "fs";
import path from "path";

function loadEnvVar(name: string) {
  if (process.env[name]) return;
  for (const file of [".env.local", ".env"]) {
    const p = path.resolve(/* turbopackIgnore: true */ process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    const re = new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`, "m");
    const m = fs.readFileSync(p, "utf8").match(re);
    if (m) {
      process.env[name] = m[1].replace(/^["']|["']$/g, "").trim();
      return;
    }
  }
}

function loadEnv() {
  // On Vercel (and any CI) env vars are injected directly — skip the fs-based
  // .env fallback entirely so Next's build tracer never has to statically
  // analyze this file's fs/path usage.
  if (process.env.VERCEL || process.env.CI) return;
  loadEnvVar("RESEND_API_KEY");
  loadEnvVar("APP_BASE_URL");
}

const FROM_ADDRESS = "Rumbo <onboarding@resend.dev>";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  loadEnv();
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/** Returns APP_BASE_URL (loading from .env.local/.env if needed). Falls back to empty string. */
export function getAppBaseUrl(): string {
  loadEnv();
  return process.env.APP_BASE_URL ?? "";
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends an email via Resend. Best-effort: if RESEND_API_KEY is absent (local dev)
 * or the send fails, logs and resolves without throwing — never blocks the caller.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email:noop] RESEND_API_KEY not set — would send "${subject}" to ${to}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    if (error) console.error(`[email:error] failed to send "${subject}" to ${to}:`, error);
  } catch (err) {
    console.error(`[email:error] failed to send "${subject}" to ${to}:`, err);
  }
}
