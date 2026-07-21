// Rumbo · Phase 2 poller: finalize client requests whose provider-acceptance
// window has closed. Triggered on a schedule by GitHub Actions (see
// .github/workflows/finalize-cron.yml), which sends the shared CRON_SECRET.
//
// Route Handlers are not cached for POST. This one does DB writes + email, so
// it must always run at request time.
import { finalizeRequestProposals, getDueRequestIds } from "@/lib/booking";

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const dueIds = await getDueRequestIds();
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const id of dueIds) {
    try {
      await finalizeRequestProposals(id);
      results.push({ id, ok: true });
    } catch (err) {
      console.error(`[cron/finalize] request ${id} failed:`, err);
      results.push({ id, ok: false, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  return Response.json({ processed: results.length, results });
}

// GitHub Actions calls POST; allow GET too for manual/health checks.
export const POST = handle;
export const GET = handle;
