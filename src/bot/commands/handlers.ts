import {
    ChatInputCommandInteraction,
    GuildMember,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';
import ms, { StringValue } from 'ms';
import { eq } from 'drizzle-orm';

async function getDbSafe() {
  const { getDb } = await import('@/db');
  const { userStats } = await import('@/db/schema');
  const database = getDb();
  if (!database) throw new Error('БД не подключена.');
  return { db: database, userStats };
}

export async function handleMute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember('user') as GuildMember;
    if (!target) return interaction.reply({ content: '❌ Пользователь не найден.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    
    try {
        const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
        const hasAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) || member?.roles.cache.some(r => r.name.toLowerCase().includes('administrator'));
        
        if (!hasAdmin && !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.editReply('❌ У вас нет прав!');
        }

        const duration = interaction.options.getString('duration') as StringValue;
        const reason = interaction.options.getString('reason') || 'Нет причины';

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

        await interaction.editReply('✅ Все каналы и роли удалены.').catch(() => {});
    } catch (error) {
        console.error('[delete] Error:', error);
        await interaction.editReply('❌ Произошла ошибка при удалении.').catch(() => {});
    }
}

export async function handleStats(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        const target = interaction.options.getUser('user') || interaction.user;
        const { db, userStats } = await getDbSafe();

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
            // ignore
        }

        const embed = new EmbedBuilder()
            .setTitle(`📊 Статистика — ${target.username}`)
            .addFields(
                { name: '📅 На сервере', value: `${daysOnServer} дней`, inline: true },
                { name: '💬 Сообщений', value: `${stats?.messageCount ?? 0}`, inline: true },
                { name: '🎙️ В войсе', value: `${stats?.voiceMinutes ?? 0} мин`, inline: true },
                { name: '💰 Баланс', value: `${stats?.coins ?? 100} монет`, inline: true },
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
