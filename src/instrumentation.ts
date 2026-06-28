export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
  // Only run in the Node.js runtime (not in the Edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Validate all required environment variables at startup.
  // Exits the process immediately if any are missing or malformed.
  const { assertEnv } = await import("@/lib/env");
  assertEnv();

  try {
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Only reset analyses older than 5 minutes — avoids killing analyses
    // dispatched seconds before a rolling deploy completes.
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { error, data } = await supabase
      .from("analyses")
      .update({
        status: "failed",
        error_message:
          "Analysis was interrupted by a server restart. Please resubmit.",
        completed_at: new Date().toISOString(),
      })
      .in("status", ["pending", "queued", "running"])
      .lt("created_at", staleThreshold)
      .select("id");

    if (error) {
      console.error("[startup] Failed to reset stale analyses:", error.message);
    } else {
      console.log(`[startup] Reset ${data?.length ?? 0} stale analyses to failed.`);
    }
  } catch (err) {
    console.error("[startup] Instrumentation error:", err);
  }
}

export const onRequestError = async (err: unknown, request: Request, context: Record<string, unknown>) => {
  const Sentry = await import("@sentry/nextjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Sentry as any).captureRequestError(err, request, context);
};
