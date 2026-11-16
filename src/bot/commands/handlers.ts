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
    if (!target) return interaction.editReply({ content: '❌ Пользователь не найден.' });

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
        return interaction.editReply({ content: '❌ Только владелец может использовать эту команду!' });
    }

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

async function isAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
    return (member?.permissions.has(PermissionFlagsBits.Administrator) || member?.roles.cache.some(r => r.name.toLowerCase().includes('administrator'))) ?? false;
}

export async function handleBan(interaction: ChatInputCommandInteraction) {
    if (!(await isAdmin(interaction))) return interaction.editReply('❌ Эта команда доступна только администраторам.');
    
    const target = interaction.options.getMember('user') as GuildMember;
    const reason = interaction.options.getString('reason') || 'Нет причины';
    if (!target) return interaction.editReply('❌ Пользователь не найден.');

    try {
        if (!target.bannable) return interaction.editReply('❌ Не могу забанить этого пользователя.');
        await target.ban({ reason });
        await interaction.editReply(`✅ **${target.user.username}** забанен. Причина: ${reason}`);
    } catch (error) {
        console.error('[ban]', error);
        await interaction.editReply('❌ Не удалось забанить.');
    }
}

export async function handleUnban(interaction: ChatInputCommandInteraction) {
    if (!(await isAdmin(interaction))) return interaction.editReply('❌ Эта команда доступна только администраторам.');
    
    const targetId = interaction.options.getString('id', true);
    try {
        await interaction.guild!.members.unban(targetId);
        await interaction.editReply(`✅ Пользователь **${targetId}** разбанен.`);
    } catch (error) {
        console.error('[unban]', error);
        await interaction.editReply('❌ Не удалось разбанить (проверьте ID).');
    }
}

export async function handleGiveCoins(interaction: ChatInputCommandInteraction) {
    if (!(await isAdmin(interaction))) return interaction.editReply('❌ Эта команда доступна только администраторам.');

    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    if (amount <= 0) return interaction.editReply('❌ Количество должно быть больше 0.');

    try {
        const { db, userStats } = await getDbSafe();
        let stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, target.id) });
        if (!stats) {
            await db.insert(userStats).values({ userId: target.id, guildId: interaction.guildId!, coins: 100 }).onConflictDoNothing();
            stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, target.id) });
        }
        await db.update(userStats).set({ coins: (stats?.coins ?? 0) + amount }).where(eq(userStats.userId, target.id));
        await interaction.editReply(`✅ Выдано **${amount} 💰** пользователю <@${target.id}>. Новый баланс: **${(stats?.coins ?? 0) + amount} 💰**`);
    } catch (error) {
        console.error('[give-coins]', error);
        await interaction.editReply('❌ Не удалось выдать монеты.');
    }
}

export async function handleTakeCoins(interaction: ChatInputCommandInteraction) {
    if (!(await isAdmin(interaction))) return interaction.editReply('❌ Эта команда доступна только администраторам.');

    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    if (amount <= 0) return interaction.editReply('❌ Количество должно быть больше 0.');

    try {
        const { db, userStats } = await getDbSafe();
        let stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, target.id) });
        if (!stats) return interaction.editReply('❌ У этого пользователя нет записи в базе.');
        const newCoins = Math.max(0, stats.coins - amount);
        await db.update(userStats).set({ coins: newCoins }).where(eq(userStats.userId, target.id));
        await interaction.editReply(`✅ Забрано **${amount} 💰** у <@${target.id}>. Новый баланс: **${newCoins} 💰**`);
    } catch (error) {
        console.error('[take-coins]', error);
        await interaction.editReply('❌ Не удалось забрать монеты.');
    }
}
