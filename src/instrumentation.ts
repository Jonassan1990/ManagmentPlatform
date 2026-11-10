/**
 * Next.js instrumentation — process-level hooks for production diagnostics.
 * Keep free of secrets; only structured logs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const onFatal = (kind: string, error: unknown) => {
    const name = error instanceof Error ? error.name : "unknown";
    const message = error instanceof Error ? error.message.slice(0, 200) : "unknown";
    console.error(`[instrumentation] ${kind}`, { name, message });
  };

  process.on("unhandledRejection", (reason) => {
    onFatal("unhandledRejection", reason);
  });
  process.on("uncaughtException", (error) => {
    onFatal("uncaughtException", error);
  });
}
