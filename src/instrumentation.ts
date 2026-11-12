/**
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * This is what actually brings the Discord bot online on Railway: previously
 * the bot only booted when somebody manually hit /api/bot-start, so a fresh
 * deploy served the web page but the bot stayed offline forever.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBot } = await import("./bot/main");
    void startBot();
  }
}
