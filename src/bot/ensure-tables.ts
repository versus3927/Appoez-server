/**
 * Ensures database tables exist by running raw CREATE TABLE IF NOT EXISTS.
 * This avoids the need for drizzle-kit push on Railway.
 */
export async function ensureTables() {
  try {
    const { getDb } = await import('@/db');
    const db = getDb();
    if (!db) return;

    const { sql } = await import('drizzle-orm');

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        voice_minutes INTEGER NOT NULL DEFAULT 0,
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_voice_join TIMESTAMP
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS private_rooms (
        channel_id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        guild_id TEXT NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id TEXT PRIMARY KEY,
        logs_channel_id TEXT,
        generator_channel_id TEXT,
        category_id TEXT,
        welcome_channel_id TEXT,
        commands_channel_id TEXT,
        music_channel_id TEXT
      )
    `);

    console.log('[db] ✅ Tables ensured.');
  } catch (error) {
    console.error('[db] ⚠️ Could not ensure tables:', error);
  }
}
