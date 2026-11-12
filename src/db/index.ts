import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * PostgreSQL access layer (Railway-ready).
 *
 *  - Never throws on import when DATABASE_URL is missing. The module-level
 *    `db` export is a lazily-resolved proxy: it initializes the pool on first
 *    use and throws a clear error ONLY if a query is attempted while the
 *    connection string is not configured.
 *  - Automatically enables SSL for remote/managed Postgres endpoints and
 *    skips it for localhost / Railway private networking (*.railway.internal).
 */

export type Database = NodePgDatabase<typeof schema>;

type CachedConnection = {
  pool: Pool | null;
  db: Database | null;
};

const globalForDb = globalThis as typeof globalThis & {
  __appoezDb?: CachedConnection;
};

const PRIVATE_ENDPOINT_PATTERN =
  /(@|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)|\.railway\.internal/i;

function createPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    console.warn(
      "[db] DATABASE_URL is not set — database access is disabled. " +
        "Add it in Railway → Variables (e.g. ${{ Postgres.DATABASE_URL }})."
    );
    return null;
  }

  const isPrivateEndpoint = PRIVATE_ENDPOINT_PATTERN.test(connectionString);

  return new Pool({
    connectionString,
    ssl: isPrivateEndpoint ? undefined : { rejectUnauthorized: false },
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
}

function getConnection(): CachedConnection {
  if (!globalForDb.__appoezDb) {
    const pool = createPool();
    globalForDb.__appoezDb = { pool, db: pool ? drizzle(pool, { schema }) : null };
  }
  return globalForDb.__appoezDb;
}

/** Returns the Drizzle client or `null` when DATABASE_URL is not configured. */
export function getDb(): Database | null {
  return getConnection().db;
}

/** Returns the pg Pool or `null` when DATABASE_URL is not configured. */
export function getPool(): Pool | null {
  return getConnection().pool;
}

/**
 * Backward-compatible export used across the bot. Lazily resolves the real
 * client on every property access, so a missing DATABASE_URL never crashes
 * the process at import time — only the actual query fails (with a clear
 * error message).
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    if (!real) {
      throw new Error(
        "DATABASE_URL is not configured. Set it in Railway → Variables and redeploy."
      );
    }
    const value = Reflect.get(real, prop);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
});
