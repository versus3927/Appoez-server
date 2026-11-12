import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '@/db';
import { guildConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

export async function handleGuildMemberAdd(member: GuildMember) {
    if (member.user.bot) return;

    let config;
    try {
        config = await db.query.guildConfigs.findFirst({
            where: eq(guildConfigs.guildId, member.guild.id),
        });
    } catch (err) {
        console.error('[welcome] DB error:', err);
        return;
    }

    if (!config?.welcomeChannelId) return;

    try {
        const channel = await member.guild.channels.fetch(config.welcomeChannelId);
        if (!channel || channel.type !== 0) return; // GuildText = 0

        const textChannel = channel as TextChannel;
        const randomMsg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        const memberCount = member.guild.memberCount;

        const embed = new EmbedBuilder()
            .setColor(0xF59E0B)
            .setDescription(
                `→ ${randomMsg(member.user.username)}`
            )
            .setFooter({ text: `Участник #${memberCount}` })
            .setTimestamp();

        await textChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('[welcome] Failed to send welcome message:', err);
    }
}
