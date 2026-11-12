import { VoiceState, EmbedBuilder, ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';
import { db } from '@/db';
import { guildConfigs, privateRooms, userStats } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * VOICE LOGS FIX:
 *
 * Problem 1: guild.channels.cache.get() fails for channels not cached yet
 *   → Fixed: use guild.channels.fetch(id) which always hits Discord API
 *
 * Problem 2: Bot lacks VIEW_CHANNEL on the hidden voice-logs channel
 *   → Fixed in setup.ts: bot gets explicit ViewChannel+SendMessages+EmbedLinks
 *
 * Problem 3: VoiceStateUpdate fires for BOTH old and new guild states.
 *   We must read member from both states carefully.
 *   → Fixed: use member ?? oldState.member with proper null checks
 *
 * Problem 4: Bot moving user to private room fires ANOTHER VoiceStateUpdate.
 *   This can double-log. We skip bot-caused moves.
 */
async function fetchTextChannel(guild: VoiceState['guild'], channelId: string): Promise<TextChannel | null> {
    try {
        const ch = await guild.channels.fetch(channelId, { cache: true, force: false });
        if (!ch) {
            console.error(`[voice-logs] ❌ Channel ${channelId} not found (fetch returned null)`);
            return null;
        }
        if (ch.type !== ChannelType.GuildText) {
            console.error(`[voice-logs] ❌ Channel ${channelId} is not a text channel (type=${ch.type})`);
            return null;
        }
        return ch as TextChannel;
    } catch (err) {
        console.error(`[voice-logs] ❌ Failed to fetch channel ${channelId}:`, err);
        return null;
    }
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    // Get member from either state
    const member = newState.member ?? oldState.member;
    const guild = newState.guild;

    if (!member || member.user.bot) return;

    // ── Fetch guild config from DB ──
    let config;
    try {
        config = await db.query.guildConfigs.findFirst({
            where: eq(guildConfigs.guildId, guild.id),
        });
    } catch (err) {
        console.error('[voice] Failed to fetch guild config:', err);
        return;
    }

    if (!config) {
        console.warn(`[voice] No guild config found for guild ${guild.id}`);
        return;
    }

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    // ═══════════════════════════════
    //  VOICE LOGGING
    // ═══════════════════════════════
    if (config.logsChannelId) {
        console.log(`[voice-logs] Event: ${member.user.username} | old=${oldChannelId ?? 'null'} new=${newChannelId ?? 'null'} | logsChannel=${config.logsChannelId}`);

        const logChannel = await fetchTextChannel(guild, config.logsChannelId);
        if (!logChannel) {
            console.error(`[voice-logs] ❌ Could not get log channel — check bot permissions on 📋・voice-logs`);
        } else {
            try {
                const embed = new EmbedBuilder().setTimestamp();

                if (!oldChannelId && newChannelId) {
                    // Joined voice
                    embed
                        .setTitle('🟢 Зашёл в голосовой канал')
                        .setColor(0x2ecc71)
                        .setDescription(
                            `**Участник:** <@${member.id}> (${member.user.username})\n` +
                            `**Канал:** <#${newChannelId}>`
                        );
                    await logChannel.send({ embeds: [embed] });
                    console.log(`[voice-logs] ✅ Logged JOIN for ${member.user.username}`);

                } else if (oldChannelId && !newChannelId) {
                    // Left voice
                    embed
                        .setTitle('🔴 Вышел из голосового канала')
                        .setColor(0xe74c3c)
                        .setDescription(
                            `**Участник:** <@${member.id}> (${member.user.username})\n` +
                            `**Канал:** <#${oldChannelId}>`
                        );
                    await logChannel.send({ embeds: [embed] });
                    console.log(`[voice-logs] ✅ Logged LEAVE for ${member.user.username}`);

                } else if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
                    // Moved between channels
                    embed
                        .setTitle('🔄 Перешёл в другой канал')
                        .setColor(0x3498db)
                        .setDescription(
                            `**Участник:** <@${member.id}> (${member.user.username})\n` +
                            `**Из:** <#${oldChannelId}>\n` +
                            `**В:** <#${newChannelId}>`
                        );
                    await logChannel.send({ embeds: [embed] });
                    console.log(`[voice-logs] ✅ Logged MOVE for ${member.user.username}`);
                }
            } catch (err) {
                console.error('[voice-logs] ❌ Failed to send embed:', err);
            }
        }
    } else {
        console.warn('[voice] No logsChannelId in config — run /сетап to set up channels');
    }

    // ═══════════════════════════════
    //  PRIVATE ROOM GENERATION
    // ═══════════════════════════════
    if (newChannelId && newChannelId === config.generatorChannelId) {
        try {
            const privateChannel = await guild.channels.create({
                name: `🏠・${member.displayName}`,
                type: ChannelType.GuildVoice,
                parent: config.categoryId || undefined,
                permissionOverwrites: [
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.MoveMembers,
                            PermissionFlagsBits.MuteMembers,
                        ],
                    },
                ],
            });

            await member.voice.setChannel(privateChannel);

            await db.insert(privateRooms).values({
                channelId: privateChannel.id,
                ownerId: member.id,
                guildId: guild.id,
            });

            console.log(`[voice] Created private room for ${member.user.username}`);
        } catch (err) {
            console.error('[voice] Failed to create private room:', err);
        }
    }

    // ═══════════════════════════════
    //  CLEANUP EMPTY PRIVATE ROOMS
    // ═══════════════════════════════
    if (oldChannelId) {
        try {
            const room = await db.query.privateRooms.findFirst({
                where: eq(privateRooms.channelId, oldChannelId),
            });

            if (room) {
                // Re-fetch channel to get accurate member count
                const channel = await guild.channels.fetch(oldChannelId, { cache: true, force: false }).catch(() => null);
                if (channel?.isVoiceBased() && channel.members.size === 0) {
                    await channel.delete().catch(() => {});
                    await db.delete(privateRooms).where(eq(privateRooms.channelId, oldChannelId));
                    console.log(`[voice] Deleted empty private room ${oldChannelId}`);
                }
            }
        } catch (err) {
            console.error('[voice] Failed to cleanup private room:', err);
        }
    }

    // ═══════════════════════════════
    //  VOICE TIME STATS
    // ═══════════════════════════════
    try {
        const now = new Date();
        if (!oldChannelId && newChannelId) {
            await db.insert(userStats).values({
                userId: member.id,
                guildId: guild.id,
                lastVoiceJoin: now,
            }).onConflictDoUpdate({
                target: userStats.userId,
                set: { lastVoiceJoin: now },
            });
        } else if (oldChannelId && !newChannelId) {
            const stats = await db.query.userStats.findFirst({
                where: eq(userStats.userId, member.id),
            });
            if (stats?.lastVoiceJoin) {
                const diffMins = Math.max(0, Math.floor(
                    (now.getTime() - stats.lastVoiceJoin.getTime()) / 60000
                ));
                await db.update(userStats)
                    .set({ voiceMinutes: (stats.voiceMinutes || 0) + diffMins, lastVoiceJoin: null })
                    .where(eq(userStats.userId, member.id));
            }
        }
    } catch (err) {
        console.error('[voice] Failed to update voice stats:', err);
    }
}
