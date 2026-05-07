// Register Sentry based on runtime
if (process.env.NEXT_RUNTIME === "nodejs") {
  require("../sentry.server.config");
} else if (process.env.NEXT_RUNTIME === "edge") {
  require("../sentry.edge.config");
}

export async function register() {
  // Only run in the Node.js runtime (not in the Edge runtime)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error, data } = await supabase
      .from("analyses")
      .update({
        status: "failed",
        error_message:
          "Analysis was interrupted by a server restart. Please resubmit.",
        completed_at: new Date().toISOString(),
      })
      .in("status", ["pending", "queued", "running"])
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
