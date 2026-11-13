import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type GuildBasedChannel,
  type TextChannel,
  type VoiceState,
} from 'discord.js';
import { getCachedConfig } from '../guild-config-cache';
import { deletePrivateRoom, getPrivateRoom, setPrivateRoom } from '../private-room-cache';

async function resolveConfig(guildId: string) {
  try {
    const { db } = await import('@/db');
    const { guildConfigs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const config = await db.query.guildConfigs.findFirst({
      where: eq(guildConfigs.guildId, guildId),
    });
    if (config) return config;
  } catch {
    // ignore db failure
  }

  return getCachedConfig(guildId);
}

function findTextChannelByName(channels: Iterable<GuildBasedChannel | null>, name: string): TextChannel | null {
  for (const channel of channels) {
    if (channel?.type === ChannelType.GuildText && channel.name === name) {
      return channel as TextChannel;
    }
  }
  return null;
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member ?? oldState.member;
  const guild = newState.guild;
  if (!member || member.user.bot) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;
  if (oldChannelId === newChannelId) return;

  const config = await resolveConfig(guild.id);

  let logsChannel: TextChannel | null = null;
  if (config?.logsChannelId) {
    const fetched = await guild.channels.fetch(config.logsChannelId).catch(() => null);
    if (fetched?.type === ChannelType.GuildText) {
      logsChannel = fetched as TextChannel;
    }
  }
  if (!logsChannel) {
    logsChannel = findTextChannelByName(guild.channels.cache.values(), '📋・voice-logs');
  }

  if (logsChannel) {
    try {
      const embed = new EmbedBuilder()
        .setTimestamp()
        .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() });

      if (!oldChannelId && newChannelId) {
        embed.setDescription(`🟢 <@${member.id}> зашёл в <#${newChannelId}>`).setColor(0x2ecc71);
      } else if (oldChannelId && !newChannelId) {
        embed.setDescription(`🔴 <@${member.id}> вышел из <#${oldChannelId}>`).setColor(0xe74c3c);
      } else if (oldChannelId && newChannelId) {
        embed.setDescription(`🔄 <@${member.id}> из <#${oldChannelId}> → <#${newChannelId}>`).setColor(0x3498db);
      }

      await logsChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('[voice-logs] send failed:', error);
    }
  }

  const generatorChannelId =
    config?.generatorChannelId ??
    guild.channels.cache.find((channel) => channel.type === ChannelType.GuildVoice && channel.name === '➕ Создать Комнату')?.id ??
    null;

  const privateRoomCategoryId =
    config?.categoryId ??
    guild.channels.cache.find((channel) => channel.type === ChannelType.GuildCategory && channel.name === '🎧・Голосовые')?.id ??
    null;

  if (newChannelId && generatorChannelId && newChannelId === generatorChannelId) {
    try {
      // Determine position: right after the generator channel
      const generatorChannel = guild.channels.cache.get(generatorChannelId);
      const position = (generatorChannel && 'position' in generatorChannel) ? generatorChannel.position + 1 : undefined;

      const room = await guild.channels.create({
        name: `🏠・${member.displayName}`,
        type: ChannelType.GuildVoice,
        parent: privateRoomCategoryId || undefined,
        position,
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
      await member.voice.setChannel(room);

      setPrivateRoom({ channelId: room.id, ownerId: member.id, guildId: guild.id });
      try {
        const { db } = await import('@/db');
        const { privateRooms } = await import('@/db/schema');
        await db.insert(privateRooms).values({
          channelId: room.id,
          ownerId: member.id,
          guildId: guild.id,
        });
      } catch {
        // ignore db failure
      }
    } catch (error) {
      console.error('[voice] Private room error:', error);
    }
  }

  // Handle cleanup of private rooms when a user leaves
  if (oldChannelId) {
    try {
      let isRoom = false;
      const cached = getPrivateRoom(oldChannelId);
      if (cached) {
        isRoom = true;
      } else {
        try {
          const { db } = await import('@/db');
          const { privateRooms } = await import('@/db/schema');
          const { eq } = await import('drizzle-orm');
          const row = await db.query.privateRooms.findFirst({ where: eq(privateRooms.channelId, oldChannelId) });
          if (row) isRoom = true;
        } catch { /* ignore */ }
      }

      const previousChannel = guild.channels.cache.get(oldChannelId);
      
      // If it's a known private room OR has the 🏠・ prefix, and it's empty, delete it
      if (previousChannel?.isVoiceBased() && previousChannel.members.size === 0) {
        if (isRoom || previousChannel.name.startsWith('🏠・')) {
          await previousChannel.delete().catch(() => {});
          deletePrivateRoom(oldChannelId);
          
          try {
            const { db } = await import('@/db');
            const { privateRooms } = await import('@/db/schema');
            const { eq } = await import('drizzle-orm');
            await db.delete(privateRooms).where(eq(privateRooms.channelId, oldChannelId));
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.error('[voice] Cleanup room error:', err);
    }
  }

  try {
    const { db } = await import('@/db');
    const { userStats } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
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
      const stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, member.id) });
      if (stats?.lastVoiceJoin) {
        const minutes = Math.max(0, Math.floor((now.getTime() - stats.lastVoiceJoin.getTime()) / 60000));
        await db.update(userStats)
          .set({ voiceMinutes: (stats.voiceMinutes || 0) + minutes, lastVoiceJoin: null })
          .where(eq(userStats.userId, member.id));
      }
    }
  } catch {
    // ignore db failure
  }
}
