import { Events, EmbedBuilder, ChannelType, type TextChannel, type Message, type PartialMessage } from 'discord.js';
import { client } from '../client';

function findLogChannel(guildId: string): TextChannel | null {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;
  const ch = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === '📋・voice-logs',
  );
  return (ch as TextChannel) ?? null;
}

function truncate(text: string | null | undefined, max = 1024): string {
  if (!text) return '_пусто_';
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}

export function registerMessageLogs() {
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    if (!message.guild || message.author?.bot) return;
    const logCh = findLogChannel(message.guild.id);
    if (!logCh) return;

    try {
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Сообщение удалено')
        .setColor(0xe74c3c)
        .addFields(
          { name: 'Автор', value: message.author ? `<@${message.author.id}> (${message.author.username})` : 'Неизвестен', inline: true },
          { name: 'Канал', value: `<#${message.channelId}>`, inline: true },
          { name: 'Содержимое', value: truncate(message.content) },
        )
        .setTimestamp();

      if (message.attachments.size > 0) {
        embed.addFields({ name: '📎 Вложения', value: message.attachments.map(a => a.url).join('\n').slice(0, 1024) });
      }

      await logCh.send({ embeds: [embed] });
    } catch (err) {
      console.error('[msg-logs] Delete log error:', err);
    }
  });

  client.on(Events.MessageUpdate, async (oldMsg: Message | PartialMessage, newMsg: Message | PartialMessage) => {
    if (!oldMsg.guild || oldMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    const logCh = findLogChannel(oldMsg.guild.id);
    if (!logCh) return;

    try {
      const embed = new EmbedBuilder()
        .setTitle('✏️ Сообщение изменено')
        .setColor(0xf39c12)
        .addFields(
          { name: 'Автор', value: oldMsg.author ? `<@${oldMsg.author.id}> (${oldMsg.author.username})` : 'Неизвестен', inline: true },
          { name: 'Канал', value: `<#${oldMsg.channelId}>`, inline: true },
          { name: 'До', value: truncate(oldMsg.content) },
          { name: 'После', value: truncate(newMsg.content) },
        )
        .setTimestamp();

      await logCh.send({ embeds: [embed] });
    } catch (err) {
      console.error('[msg-logs] Update log error:', err);
    }
  });

  console.log('[bot] ✅ Message logs (delete/edit) registered.');
}
