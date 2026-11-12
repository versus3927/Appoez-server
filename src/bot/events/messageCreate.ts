import { Message } from 'discord.js';
import { db } from '@/db';
import { guildConfigs, userStats } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// Cache to avoid DB query on every message
const commandsChannelCache = new Map<string, string | null>();

async function getCommandsChannelId(guildId: string): Promise<string | null> {
    if (commandsChannelCache.has(guildId)) {
        return commandsChannelCache.get(guildId)!;
    }

    try {
        const config = await db.query.guildConfigs.findFirst({
            where: eq(guildConfigs.guildId, guildId),
        });
        const id = config?.commandsChannelId ?? null;
        commandsChannelCache.set(guildId, id);
        // Refresh cache every 5 minutes
        setTimeout(() => commandsChannelCache.delete(guildId), 5 * 60 * 1000);
        return id;
    } catch {
        return null;
    }
}

export async function handleMessageCreate(message: Message) {
    if (message.author.bot || !message.guild) return;

    // ── Auto-delete non-command messages in 🤖・команды channel ──
    try {
        const cmdChannelId = await getCommandsChannelId(message.guild.id);
        if (cmdChannelId && message.channelId === cmdChannelId) {
            // Slash commands are interactions, not messages.
            // Any regular text message in this channel gets deleted.
            const warning = await message.reply(
                '⚠️ Этот канал только для **слеш-команд**! Напиши `/` чтобы увидеть список.'
            );
            // Delete both messages after 4 seconds
            setTimeout(() => {
                message.delete().catch(() => {});
                warning.delete().catch(() => {});
            }, 4000);
            return; // Don't count this message in stats
        }
    } catch {
        // Ignore errors in cleanup logic
    }

    // ── Message stats ──
    try {
        await db.insert(userStats).values({
            userId: message.author.id,
            guildId: message.guild.id,
            messageCount: 1,
        }).onConflictDoUpdate({
            target: userStats.userId,
            set: {
                messageCount: sql`${userStats.messageCount} + 1`,
            },
        });
    } catch (err) {
        console.error('[messageCreate] Stats error:', err);
    }
}
