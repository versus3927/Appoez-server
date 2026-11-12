import {
    ChatInputCommandInteraction,
    GuildMember,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';
import ms, { StringValue } from 'ms';
import { db } from '@/db';
import { userStats } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function handleMute(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });
    }

    const target = interaction.options.getMember('user') as GuildMember;
    const duration = interaction.options.getString('duration') as StringValue;
    const reason = interaction.options.getString('reason') || 'Нет причины';

    if (!target) return interaction.reply({ content: '❌ Пользователь не найден.', ephemeral: true });

    await interaction.deferReply();

    try {
        const msDuration = ms(duration || '10m');
        await target.timeout(msDuration, reason);
        await interaction.editReply(
            `🔇 Пользователь ${target.user.username} замучен на **${duration}**.\nПричина: ${reason}`
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[mute] Error:', msg);
        await interaction.editReply(`❌ Ошибка при муте: ${msg}`);
    }
}

export async function handleDelete(interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== interaction.guild?.ownerId) {
        return interaction.reply({ content: '❌ Только владелец может использовать эту команду!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const channels = await interaction.guild.channels.fetch();
        for (const channel of channels.values()) {
            if (channel) await channel.delete().catch(() => {});
        }

        const roles = await interaction.guild.roles.fetch();
        for (const role of roles.values()) {
            if (role.name !== '@everyone' && !role.managed) {
                await role.delete().catch(() => {});
            }
        }

        // Can't editReply if the channel was deleted, so just catch silently
        await interaction.editReply('✅ Все каналы и роли удалены.').catch(() => {});
    } catch (error) {
        console.error('[delete] Error:', error);
        await interaction.editReply('❌ Произошла ошибка при удалении.').catch(() => {});
    }
}

export async function handleStats(interaction: ChatInputCommandInteraction) {
    // deferReply immediately — prevents "Application did not respond"
    await interaction.deferReply();

    try {
        const target = interaction.options.getUser('user') || interaction.user;

        let stats = null;
        try {
            stats = await db.query.userStats.findFirst({
                where: eq(userStats.userId, target.id),
            });
        } catch (dbErr) {
            console.error('[stats] DB query failed:', dbErr);
        }

        let daysOnServer = 0;
        try {
            const member = await interaction.guild?.members.fetch(target.id);
            const joinedAt = member?.joinedAt || new Date();
            const now = new Date();
            daysOnServer = Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
        } catch {
            // Member might not be in the guild
        }

        const embed = new EmbedBuilder()
            .setTitle(`📊 Статистика — ${target.username}`)
            .addFields(
                { name: '📅 На сервере', value: `${daysOnServer} дней`, inline: true },
                { name: '💬 Сообщений', value: `${stats?.messageCount ?? 0}`, inline: true },
                { name: '🎙️ В войсе', value: `${stats?.voiceMinutes ?? 0} мин`, inline: true },
            )
            .setColor(0x2ECC71)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setFooter({ text: 'Appoez Bot • Статистика' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[stats] Error:', msg);
        await interaction.editReply(`❌ Не удалось получить статистику: ${msg}`).catch(() => {});
    }
}
