import { VoiceState, EmbedBuilder, ChannelType, TextChannel } from 'discord.js';
import { db } from '@/db';
import { guildConfigs, privateRooms, userStats } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * DEFINITIVE VOICE LOGS FIX:
 *
 * Root cause: bot can't write to a hidden channel unless it has an explicit
 * MEMBER-level permission overwrite (not just role-based).
 *
 * Solution: voice-logs is now a READ-ONLY channel visible to everyone,
 * where only the bot can send messages. This guarantees the bot always
 * has access regardless of permission configuration.
 */
async function getTextChannel(guild: VoiceState['guild'], channelId: string): Promise<TextChannel | null> {
    try {
        // Always fetch fresh from API, never rely on cache
        const ch = await guild.channels.fetch(channelId, { force: true, cache: false });
        if (!ch || ch.type !== ChannelType.GuildText) {
            console.error(`[voice-logs] ❌ Channel ${channelId} not found or wrong type (${ch?.type})`);
            return null;
        }
        return ch as TextChannel;
    } catch (err) {
        console.error(`[voice-logs] ❌ Fetch error for ${channelId}:`, err);
        return null;
    }
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member ?? oldState.member;
    const guild = newState.guild;

    if (!member || member.user.bot) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // No actual change (mute/deaf/stream toggle) — skip
    if (oldChannelId === newChannelId) return;

    // Fetch guild config
    let config;
    try {
        config = await db.query.guildConfigs.findFirst({
            where: eq(guildConfigs.guildId, guild.id),
        });
    } catch (err) {
        console.error('[voice] DB error fetching config:', err);
        return;
    }

    if (!config) return;

    // ════════════════════════════════
    //  VOICE LOGGING
    // ════════════════════════════════
    if (config.logsChannelId) {
        try {
            const logCh = await getTextChannel(guild, config.logsChannelId);
            if (logCh) {
                const embed = new EmbedBuilder()
                    .setTimestamp()
                    .setAuthor({
                        name: member.user.username,
                        iconURL: member.user.displayAvatarURL(),
                    });

                if (!oldChannelId && newChannelId) {
                    embed.setDescription(`🟢 <@${member.id}> зашёл в <#${newChannelId}>`).setColor(0x2ecc71);
                } else if (oldChannelId && !newChannelId) {
                    embed.setDescription(`🔴 <@${member.id}> вышел из <#${oldChannelId}>`).setColor(0xe74c3c);
                } else if (oldChannelId && newChannelId) {
                    embed.setDescription(`🔄 <@${member.id}> перешёл из <#${oldChannelId}> в <#${newChannelId}>`).setColor(0x3498db);
                }

                await logCh.send({ embeds: [embed] });
                console.log(`[voice-logs] ✅ Logged for ${member.user.username}`);
            }
        } catch (err) {
            console.error('[voice-logs] ❌ Failed to send log:', err);
        }
    }

    // ════════════════════════════════
    //  PRIVATE ROOM GENERATION
    // ════════════════════════════════
    if (newChannelId && newChannelId === config.generatorChannelId) {
        try {
            const { ChannelType: CT, PermissionFlagsBits } = await import('discord.js');
            const room = await guild.channels.create({
                name: `🏠・${member.displayName}`,
                type: CT.GuildVoice,
                parent: config.categoryId || undefined,
                permissionOverwrites: [{
                    id: member.id,
                    allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers],
                }],
            });
            await member.voice.setChannel(room);
            await db.insert(privateRooms).values({ channelId: room.id, ownerId: member.id, guildId: guild.id });
        } catch (err) {
            console.error('[voice] Failed to create private room:', err);
        }
    }

    // ════════════════════════════════
    //  CLEANUP EMPTY PRIVATE ROOMS
    // ════════════════════════════════
    if (oldChannelId) {
        try {
            const room = await db.query.privateRooms.findFirst({ where: eq(privateRooms.channelId, oldChannelId) });
            if (room) {
                const ch = guild.channels.cache.get(oldChannelId);
                if (ch?.isVoiceBased() && ch.members.size === 0) {
                    await ch.delete().catch(() => {});
                    await db.delete(privateRooms).where(eq(privateRooms.channelId, oldChannelId));
                }
            }
        } catch (err) {
            console.error('[voice] Cleanup error:', err);
        }
    }

    // ════════════════════════════════
    //  VOICE TIME STATS
    // ════════════════════════════════
    try {
        const now = new Date();
        if (!oldChannelId && newChannelId) {
            await db.insert(userStats).values({ userId: member.id, guildId: guild.id, lastVoiceJoin: now })
                .onConflictDoUpdate({ target: userStats.userId, set: { lastVoiceJoin: now } });
        } else if (oldChannelId && !newChannelId) {
            const stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, member.id) });
            if (stats?.lastVoiceJoin) {
                const mins = Math.max(0, Math.floor((now.getTime() - stats.lastVoiceJoin.getTime()) / 60000));
                await db.update(userStats)
                    .set({ voiceMinutes: (stats.voiceMinutes || 0) + mins, lastVoiceJoin: null })
                    .where(eq(userStats.userId, member.id));
            }
        }
    } catch (err) {
        console.error('[voice] Stats error:', err);
    }
}
