export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureModerationSchedulerStarted } = await import(
      "@/server/moderation/scheduler"
    );
    ensureModerationSchedulerStarted();
  }
}
