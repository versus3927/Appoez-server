import {
    Interaction,
    TextInputStyle,
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    ModalActionRowComponentBuilder,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
} from 'discord.js';
import { db } from '@/db';
import { privateRooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { handleMute, handleDelete, handleStats } from '../commands/handlers';
import { handleSetup } from '../commands/setup';
import { handlePlay, handleSkip, handleStop, handleQueue } from '../commands/music';
import { handleRoll, handle8Ball, handleAvatar } from '../commands/fun';

export async function handleInteraction(interaction: Interaction) {
    // ── Slash Commands ──
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'сетап') {
            if (!interaction.guild) return;
            await interaction.deferReply({ ephemeral: true });
            try {
                await handleSetup(interaction.guild);
                await interaction.editReply('✅ Настройка завершена! Каналы и роли созданы.');
            } catch (err) {
                console.error('[setup] Error:', err);
                const msg = err instanceof Error ? err.message : String(err);
                await interaction.editReply(`❌ Ошибка при настройке: ${msg}`).catch(() => {});
            }
        } else if (commandName === 'муте') {
            await handleMute(interaction);
        } else if (commandName === 'делит') {
            await handleDelete(interaction);
        } else if (commandName === 'стата') {
            await handleStats(interaction);
        } else if (commandName === 'музыка') {
            await handlePlay(interaction);
        } else if (commandName === 'скип') {
            await handleSkip(interaction);
        } else if (commandName === 'стоп') {
            await handleStop(interaction);
        } else if (commandName === 'очередь') {
            await handleQueue(interaction);
        } else if (commandName === 'ролл') {
            await handleRoll(interaction);
        } else if (commandName === 'шар') {
            await handle8Ball(interaction);
        } else if (commandName === 'аватар') {
            await handleAvatar(interaction);
        }
    }

    // ── Button Interactions ──
    if (interaction.isButton()) {
        const { customId, member, guild, channelId } = interaction;
        if (!customId.startsWith('room_')) return;
        if (!guild || !channelId || !member) return;

        let room;
        try {
            room = await db.query.privateRooms.findFirst({
                where: eq(privateRooms.channelId, channelId),
            });
        } catch (err) {
            console.error('[button] DB error:', err);
            return interaction.reply({ content: '❌ Ошибка базы данных.', ephemeral: true });
        }

        if (!room || room.ownerId !== member.user.id) {
            return interaction.reply({ content: '❌ Вы не владелец этой комнаты!', ephemeral: true });
        }

        const channel = guild.channels.cache.get(channelId) as any;
        if (!channel || channel.type !== ChannelType.GuildVoice) {
            return interaction.reply({ content: '❌ Канал не найден.', ephemeral: true });
        }

        switch (customId) {
            case 'room_rename': {
                const modal = new ModalBuilder()
                    .setCustomId('modal_room_rename')
                    .setTitle('✏️ Изменить название');
                const input = new TextInputBuilder()
                    .setCustomId('new_name')
                    .setLabel('Новое название')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(32);
                modal.addComponents(
                    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input)
                );
                return interaction.showModal(modal);
            }
            case 'room_lock': {
                const isLocked = channel.permissionOverwrites.cache
                    .get(guild.id)
                    ?.deny.has(PermissionFlagsBits.Connect);
                await channel.permissionOverwrites.edit(guild.id, {
                    Connect: isLocked ? null : false,
                });
                return interaction.reply({
                    content: isLocked ? '🔓 Комната открыта' : '🔒 Комната закрыта',
                    ephemeral: true,
                });
            }
            case 'room_limit': {
                const modal = new ModalBuilder()
                    .setCustomId('modal_room_limit')
                    .setTitle('👥 Изменить лимит');
                const input = new TextInputBuilder()
                    .setCustomId('new_limit')
                    .setLabel('Лимит (0-99, 0 = без лимита)')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(2);
                modal.addComponents(
                    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input)
                );
                return interaction.showModal(modal);
            }
            case 'room_visibility': {
                const isHidden = channel.permissionOverwrites.cache
                    .get(guild.id)
                    ?.deny.has(PermissionFlagsBits.ViewChannel);
                await channel.permissionOverwrites.edit(guild.id, {
                    ViewChannel: isHidden ? null : false,
                });
                return interaction.reply({
                    content: isHidden ? '👁️ Комната теперь видна' : '🙈 Комната скрыта',
                    ephemeral: true,
                });
            }
            case 'room_ban': {
                const modal = new ModalBuilder()
                    .setCustomId('modal_room_ban')
                    .setTitle('🚫 Бан пользователя');
                const input = new TextInputBuilder()
                    .setCustomId('ban_user_id')
                    .setLabel('ID пользователя для бана')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Правый клик → Скопировать ID')
                    .setMaxLength(20);
                modal.addComponents(
                    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input)
                );
                return interaction.showModal(modal);
            }
            case 'room_kick': {
                const modal = new ModalBuilder()
                    .setCustomId('modal_room_kick')
                    .setTitle('⚡ Выгнать пользователя');
                const input = new TextInputBuilder()
                    .setCustomId('kick_user_id')
                    .setLabel('ID пользователя для кика')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Правый клик → Скопировать ID')
                    .setMaxLength(20);
                modal.addComponents(
                    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input)
                );
                return interaction.showModal(modal);
            }
            case 'room_mute': {
                const modal = new ModalBuilder()
                    .setCustomId('modal_room_mute')
                    .setTitle('🎙️ Мут пользователя');
                const input = new TextInputBuilder()
                    .setCustomId('mute_user_id')
                    .setLabel('ID пользователя для мута')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Правый клик → Скопировать ID')
                    .setMaxLength(20);
                modal.addComponents(
                    new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input)
                );
                return interaction.showModal(modal);
            }
            case 'room_info': {
                const membersInChannel = channel.members?.size ?? 0;
                const embed = new EmbedBuilder()
                    .setTitle('ℹ️ Информация о комнате')
                    .addFields(
                        { name: '👤 Владелец', value: `<@${room.ownerId}>`, inline: true },
                        { name: '📝 Название', value: channel.name, inline: true },
                        { name: '👥 Лимит', value: `${channel.userLimit || 'Без лимита'}`, inline: true },
                        { name: '🧑‍🤝‍🧑 Сейчас', value: `${membersInChannel} чел.`, inline: true },
                    )
                    .setColor(0x8B5CF6);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }
            default:
                return interaction.reply({
                    content: '❓ Неизвестная кнопка.',
                    ephemeral: true,
                });
        }
    }

    // ── Modal Submissions ──
    if (interaction.isModalSubmit()) {
        const { customId, guild, channelId } = interaction;

        if (customId === 'modal_room_rename') {
            const newName = interaction.fields.getTextInputValue('new_name');
            try {
                const channel = guild?.channels.cache.get(channelId!) as any;
                await channel?.setName(newName);
                return interaction.reply({ content: `✏️ Название изменено: **${newName}**`, ephemeral: true });
            } catch {
                return interaction.reply({ content: '❌ Не удалось изменить название.', ephemeral: true });
            }
        }

        if (customId === 'modal_room_limit') {
            const limitStr = interaction.fields.getTextInputValue('new_limit');
            const limit = parseInt(limitStr);
            if (isNaN(limit) || limit < 0 || limit > 99) {
                return interaction.reply({ content: '❌ Лимит должен быть от 0 до 99.', ephemeral: true });
            }
            try {
                const channel = guild?.channels.cache.get(channelId!) as any;
                await channel?.setUserLimit(limit);
                return interaction.reply({
                    content: limit === 0 ? '👥 Лимит снят' : `👥 Лимит: **${limit}**`,
                    ephemeral: true,
                });
            } catch {
                return interaction.reply({ content: '❌ Не удалось изменить лимит.', ephemeral: true });
            }
        }

        if (customId === 'modal_room_ban') {
            const targetId = interaction.fields.getTextInputValue('ban_user_id').trim();
            try {
                const channel = guild?.channels.cache.get(channelId!) as any;
                await channel?.permissionOverwrites.edit(targetId, { Connect: false, ViewChannel: false });
                const targetMember = channel?.members?.get(targetId);
                if (targetMember) await targetMember.voice.disconnect();
                return interaction.reply({ content: `🚫 Пользователь <@${targetId}> забанен в комнате.`, ephemeral: true });
            } catch {
                return interaction.reply({ content: '❌ Не удалось забанить. Проверьте ID.', ephemeral: true });
            }
        }

        if (customId === 'modal_room_kick') {
            const targetId = interaction.fields.getTextInputValue('kick_user_id').trim();
            try {
                const channel = guild?.channels.cache.get(channelId!) as any;
                const targetMember = channel?.members?.get(targetId);
                if (targetMember) {
                    await targetMember.voice.disconnect();
                    return interaction.reply({ content: `⚡ Пользователь <@${targetId}> выгнан.`, ephemeral: true });
                } else {
                    return interaction.reply({ content: '❌ Пользователь не в этом канале.', ephemeral: true });
                }
            } catch {
                return interaction.reply({ content: '❌ Не удалось кикнуть. Проверьте ID.', ephemeral: true });
            }
        }

        if (customId === 'modal_room_mute') {
            const targetId = interaction.fields.getTextInputValue('mute_user_id').trim();
            try {
                const channel = guild?.channels.cache.get(channelId!) as any;
                const targetMember = channel?.members?.get(targetId);
                if (targetMember) {
                    const isMuted = targetMember.voice.serverMute;
                    await targetMember.voice.setMute(!isMuted);
                    return interaction.reply({
                        content: isMuted
                            ? `🎙️ <@${targetId}> размучен.`
                            : `🔇 <@${targetId}> замучен.`,
                        ephemeral: true,
                    });
                } else {
                    return interaction.reply({ content: '❌ Пользователь не в этом канале.', ephemeral: true });
                }
            } catch {
                return interaction.reply({ content: '❌ Не удалось замутить. Проверьте ID.', ephemeral: true });
            }
        }
    }
}
