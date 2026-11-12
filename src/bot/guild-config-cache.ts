/**
 * In-memory guild config cache.
 * 
 * Solves the Railway DATABASE_URL misconfiguration problem:
 * when DB is unreachable, /сетап stores config here so
 * voice-logs and other features still work within the same process lifetime.
 */

export interface GuildConfig {
    guildId: string;
    logsChannelId: string | null;
    generatorChannelId: string | null;
    categoryId: string | null;
    welcomeChannelId: string | null;
    commandsChannelId: string | null;
    musicChannelId: string | null;
}

const cache = new Map<string, GuildConfig>();

export function setCachedConfig(config: GuildConfig) {
    cache.set(config.guildId, config);
    console.log(`[config-cache] Saved config for guild ${config.guildId}`);
}

export function getCachedConfig(guildId: string): GuildConfig | null {
    return cache.get(guildId) ?? null;
}
