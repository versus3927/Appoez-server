import { NextResponse } from "next/server";
import { startBot } from "@/bot/main";
import { getBotStatus } from "@/bot/status";

export const dynamic = "force-dynamic";

/**
 * Manual fallback trigger — the bot normally auto-starts via
 * `src/instrumentation.ts` on server boot. Kept for one-off environments
 * where the instrumentation hook is unavailable.
 */
export async function GET() {
  const started = await startBot();
  return NextResponse.json({
    started,
    bot: getBotStatus(),
  });
}

export async function POST() {
  const started = await startBot();
  return NextResponse.json({
    started,
    bot: getBotStatus(),
  });
}
