import { ChannelType, EmbedBuilder, type GuildMember, type TextChannel } from 'discord.js';
import { getCachedConfig } from '../guild-config-cache';

const welcomeMessages = [
  (name: string) => `Рады встрече, **${name}**. 👋`,
  (name: string) => `Знакомьтесь, это **${name}**! 🎉`,
  (name: string) => `**${name}** уже с нами! 🔥`,
  (name: string) => `Ура, **${name}** теперь с нами! 🎊`,
  (name: string) => `Дикий **${name}** появился. ⚡`,
  (name: string) => `**${name}** присоединяется к вашей пати. 🎮`,
  (name: string) => `Привет, **${name}**. Поздоровайся со всеми! 💜`,
  (name: string) => `Рады тебя видеть, **${name}**! ✨`,
];

async function resolveWelcomeChannel(member: GuildMember): Promise<TextChannel | null> {
  try {
    const { db } = await import('@/db');
    const { guildConfigs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const config = await db.query.guildConfigs.findFirst({
      where: eq(guildConfigs.guildId, member.guild.id),
    });
    if (config?.welcomeChannelId) {
      const channel = await member.guild.channels.fetch(config.welcomeChannelId);
      if (channel?.type === ChannelType.GuildText) return channel as TextChannel;
    }
  } catch {
    // ignore db failure
  }

  const cached = getCachedConfig(member.guild.id);
  if (cached?.welcomeChannelId) {
    const channel = await member.guild.channels.fetch(cached.welcomeChannelId).catch(() => null);
    if (channel?.type === ChannelType.GuildText) return channel as TextChannel;
  }

  const byName = member.guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildText && channel.name === '🔔・участники',
  );
  return (byName as TextChannel | undefined) ?? null;
}

export async function handleGuildMemberAdd(member: GuildMember) {
  if (member.user.bot) return;

  try {
    const channel = await resolveWelcomeChannel(member);
    if (!channel) return;

    const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    const embed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setDescription(`→ ${randomMessage(member.user.username)}`)
      .setFooter({ text: `Участник #${member.guild.memberCount}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('[welcome] Failed to send welcome message:', error);
  }
}
