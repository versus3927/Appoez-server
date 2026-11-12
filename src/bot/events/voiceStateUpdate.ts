import { VoiceState, EmbedBuilder, ChannelType, PermissionFlagsBits, TextChannel } from 'discord.js';
import { getCachedConfig } from '../guild-config-cache';

// Try DB, fall back to cache
async function getConfig(guildId: string) {
    // Try database first
    try {
        const { db } = await import('@/db');
        const { guildConfigs } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');
        const config = await db.query.guildConfigs.findFirst({
            where: eq(guildConfigs.guildId, guildId),
        });
        if (config) return config;
    } catch (err) {
        console.warn('[voice] DB unavailable, using cache. Error:', (err as Error).message?.slice(0, 80));
    }
    // Fall back to in-memory cache
    return getCachedConfig(guildId);
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member ?? oldState.member;
    const guild = newState.guild;
    if (!member || member.user.bot) return;

    const oldCh = oldState.channelId;
    const newCh = newState.channelId;
    if (oldCh === newCh) return; // mute/deaf toggle

    const config = await getConfig(guild.id);
    if (!config) {
        console.warn(`[voice] No config for guild ${guild.id} — run /сетап`);
        return;
    }

    // ── VOICE LOGGING ──
    if (config.logsChannelId) {
        try {
            const ch = await guild.channels.fetch(config.logsChannelId, { force: true });
            if (ch && ch.type === ChannelType.GuildText) {
                const logCh = ch as TextChannel;
                const embed = new EmbedBuilder()
                    .setTimestamp()
                    .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() });

                if (!oldCh && newCh) {
                    embed.setDescription(`🟢 <@${member.id}> зашёл в <#${newCh}>`).setColor(0x2ecc71);
                } else if (oldCh && !newCh) {
                    embed.setDescription(`🔴 <@${member.id}> вышел из <#${oldCh}>`).setColor(0xe74c3c);
                } else if (oldCh && newCh) {
                    embed.setDescription(`🔄 <@${member.id}> из <#${oldCh}> → <#${newCh}>`).setColor(0x3498db);
                }

                await logCh.send({ embeds: [embed] });
                console.log(`[voice-logs] ✅ ${member.user.username}`);
            }
        } catch (err) {
            console.error('[voice-logs] ❌', (err as Error).message);
        }
    }

    // ── PRIVATE ROOMS ──
    if (newCh && newCh === config.generatorChannelId) {
        try {
            const room = await guild.channels.create({
                name: `🏠・${member.displayName}`,
                type: ChannelType.GuildVoice,
                parent: config.categoryId || undefined,
                permissionOverwrites: [{
                    id: member.id,
                    allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers],
                }],
            });
            await member.voice.setChannel(room);
            try {
                const { db } = await import('@/db');
                const { privateRooms } = await import('@/db/schema');
                await db.insert(privateRooms).values({ channelId: room.id, ownerId: member.id, guildId: guild.id });
            } catch { /* DB down — room still works */ }
        } catch (err) {
            console.error('[voice] Private room error:', err);
        }
    }

    // ── CLEANUP EMPTY ROOMS ──
    if (oldCh) {
        try {
            const { db } = await import('@/db');
            const { privateRooms } = await import('@/db/schema');
            const { eq } = await import('drizzle-orm');
            const room = await db.query.privateRooms.findFirst({ where: eq(privateRooms.channelId, oldCh) });
            if (room) {
                const chan = guild.channels.cache.get(oldCh);
                if (chan?.isVoiceBased() && chan.members.size === 0) {
                    await chan.delete().catch(() => {});
                    await db.delete(privateRooms).where(eq(privateRooms.channelId, oldCh));
                }
            }
        } catch { /* DB down */ }
    }

    // ── VOICE STATS ──
    try {
        const { db } = await import('@/db');
        const { userStats } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');
        const now = new Date();
        if (!oldCh && newCh) {
            await db.insert(userStats).values({ userId: member.id, guildId: guild.id, lastVoiceJoin: now })
                .onConflictDoUpdate({ target: userStats.userId, set: { lastVoiceJoin: now } });
        } else if (oldCh && !newCh) {
            const stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, member.id) });
            if (stats?.lastVoiceJoin) {
                const mins = Math.max(0, Math.floor((now.getTime() - stats.lastVoiceJoin.getTime()) / 60000));
                await db.update(userStats).set({ voiceMinutes: (stats.voiceMinutes || 0) + mins, lastVoiceJoin: null })
                    .where(eq(userStats.userId, member.id));
            }
        }
    } catch { /* DB down — stats lost but not critical */ }
}
