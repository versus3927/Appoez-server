import type { Message } from 'discord.js';
import { getCachedConfig } from '../guild-config-cache';

const READONLY_CHANNEL_NAMES = new Set([
  '🔔・участники',
  '📋・voice-logs',
  '📌・правила',
  '📚・faq',
  '💞・tag',
  '💗・анонимки',
  '🎮・управление',
]);

async function resolveCommandsChannelId(message: Message): Promise<string | null> {
  try {
    const { db } = await import('@/db');
    const { guildConfigs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const config = await db.query.guildConfigs.findFirst({
      where: eq(guildConfigs.guildId, message.guild!.id),
    });
    if (config?.commandsChannelId) return config.commandsChannelId;
  } catch {
    // ignore
  }

  const cached = getCachedConfig(message.guild!.id);
  if (cached?.commandsChannelId) return cached.commandsChannelId;

  const byName = message.guild!.channels.cache.find(
    (channel) => channel.type === 0 && channel.name === '🤖・команды',
  );
  return byName?.id ?? null;
}

export async function handleMessageCreate(message: Message) {
  if (message.author.bot || !message.guild) return;

  const channelName = ('name' in message.channel ? message.channel.name : '') ?? '';

  // Delete regular messages in commands channel
  const commandsChannelId = await resolveCommandsChannelId(message);
  if (commandsChannelId && message.channelId === commandsChannelId) {
    const warning = await message.reply('⚠️ Этот канал только для **слеш-команд**! Нажми `/` и выбери команду.').catch(() => null);
    setTimeout(() => {
      void message.delete().catch(() => {});
      void warning?.delete().catch(() => {});
    }, 4000);
    return;
  }

  // Delete regular messages in readonly channels
  if (READONLY_CHANNEL_NAMES.has(channelName)) {
    const warning = await message.reply('⚠️ Этот канал только для чтения / кнопок.').catch(() => null);
    setTimeout(() => {
      void message.delete().catch(() => {});
      void warning?.delete().catch(() => {});
    }, 4000);
    return;
  }

  // Non-critical stats update — ignore DB errors
  try {
    const { db } = await import('@/db');
    const { userStats } = await import('@/db/schema');
    const { sql } = await import('drizzle-orm');
    await db.insert(userStats).values({
      userId: message.author.id,
      guildId: message.guild.id,
      messageCount: 1,
    }).onConflictDoUpdate({
      target: userStats.userId,
      set: { messageCount: sql`${userStats.messageCount} + 1` },
    });
  } catch {
    // Database may be unavailable on Railway; ignore
  }
}
