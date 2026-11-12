import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getBotStatus } from "@/bot/status";

export const dynamic = "force-dynamic";

const DB_CHECK_TIMEOUT_MS = 4_000;
const bootedAt = Date.now();

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function checkDatabase() {
  const database = getDb();

  if (!database) {
    return {
      configured: false,
      connected: false,
      error: "DATABASE_URL is not set",
    } as const;
  }

  const startedAt = Date.now();
  try {
    await withTimeout(database.execute(sql`select 1`), DB_CHECK_TIMEOUT_MS);
    return {
      configured: true,
      connected: true,
      latencyMs: Date.now() - startedAt,
    } as const;
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    } as const;
  }
}

/**
 * Liveness probe for Railway (`railway.json` points the healthcheck here).
 *
 * Always answers 200 while the HTTP server itself is alive — the database and
 * bot states are reported in the body. Restarting the container cannot fix a
 * missing env var, so a DB outage should not flap the deployment.
 */
export async function GET() {
  const database = await checkDatabase();
  const bot = getBotStatus();

  return Response.json({
    ok: true,
    service: "appoez-server",
    status:
      database.configured && !database.connected ? "degraded" : "operational",
    uptimeSec: Math.round((Date.now() - bootedAt) / 1000),
    node: process.version,
    database,
    bot,
    timestamp: new Date().toISOString(),
  });
}
