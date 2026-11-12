import { VoiceState, EmbedBuilder, ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';
import { db } from '@/db';
import { guildConfigs, privateRooms, userStats } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Fetch the log channel reliably.
 * `guild.channels.cache.get()` misses channels the bot hasn't interacted with yet.
 * `guild.channels.fetch()` always hits the API and guarantees a fresh result.
 */
async function fetchLogChannel(guild: VoiceState['guild'], channelId: string): Promise<TextChannel | null> {
    try {
        const ch = await guild.channels.fetch(channelId);
        if (ch && ch.isTextBased() && ch.type === ChannelType.GuildText) {
            return ch as TextChannel;
        }
        return null;
    } catch {
        return null;
    }
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const { member, guild } = newState;
    if (!member || member.user.bot) return;

    let config;
    try {
        config = await db.query.guildConfigs.findFirst({
            where: eq(guildConfigs.guildId, guild.id),
        });
    } catch (err) {
        console.error('[voice] Failed to fetch guild config:', err);
        return;
    }

    if (!config) return;

    // ── Voice Logging ──
    if (config.logsChannelId) {
        const logChannel = await fetchLogChannel(guild, config.logsChannelId);

        if (logChannel) {
            try {
                const embed = new EmbedBuilder().setTimestamp();

                if (!oldState.channelId && newState.channelId) {
                    // Joined
                    embed.setTitle('🟢 Зашёл в голосовой')
                        .setColor(0x2ecc71)
                        .setDescription(
                            `**Участник:** <@${member.id}>\n` +
                            `**Канал:** <#${newState.channelId}>`
                        );
                    await logChannel.send({ embeds: [embed] });
                } else if (oldState.channelId && !newState.channelId) {
                    // Left
                    embed.setTitle('🔴 Вышел из голосового')
                        .setColor(0xe74c3c)
                        .setDescription(
                            `**Участник:** <@${member.id}>\n` +
                            `**Канал:** <#${oldState.channelId}>`
                        );
                    await logChannel.send({ embeds: [embed] });
                } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                    // Moved
                    embed.setTitle('🔄 Перешёл в другой канал')
                        .setColor(0x3498db)
                        .setDescription(
                            `**Участник:** <@${member.id}>\n` +
                            `**Из:** <#${oldState.channelId}>\n` +
                            `**В:** <#${newState.channelId}>`
                        );
                    await logChannel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('[voice] Failed to send voice log:', err);
            }
        }
    }

    // ── Private Room Generation ──
    if (newState.channelId === config.generatorChannelId) {
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
        } catch (err) {
            console.error('[voice] Failed to create private room:', err);
        }
    }

    // ── Cleanup Empty Private Rooms ──
    if (oldState.channelId) {
        try {
            const room = await db.query.privateRooms.findFirst({
                where: eq(privateRooms.channelId, oldState.channelId),
            });

            if (room) {
                const channel = guild.channels.cache.get(oldState.channelId);
                if (channel?.isVoiceBased() && channel.members.size === 0) {
                    await channel.delete().catch(() => {});
                    await db.delete(privateRooms).where(eq(privateRooms.channelId, oldState.channelId));
                }
            }
        } catch (err) {
            console.error('[voice] Failed to cleanup private room:', err);
        }
    }

    // ── Voice Time Stats ──
    try {
        const now = new Date();
        if (!oldState.channelId && newState.channelId) {
            // Just joined voice — record start time
            await db.insert(userStats).values({
                userId: member.id,
                guildId: guild.id,
                lastVoiceJoin: now,
            }).onConflictDoUpdate({
                target: userStats.userId,
                set: { lastVoiceJoin: now },
            });
        } else if (oldState.channelId && !newState.channelId) {
            // Left voice — calculate duration
            const stats = await db.query.userStats.findFirst({
                where: eq(userStats.userId, member.id),
            });

            if (stats?.lastVoiceJoin) {
                const diffMs = now.getTime() - stats.lastVoiceJoin.getTime();
                const diffMins = Math.max(0, Math.floor(diffMs / 60000));

                await db.update(userStats)
                    .set({
                        voiceMinutes: (stats.voiceMinutes || 0) + diffMins,
                        lastVoiceJoin: null,
                    })
                    .where(eq(userStats.userId, member.id));
            }
        }
    } catch (err) {
        console.error('[voice] Failed to update voice stats:', err);
    }
}
