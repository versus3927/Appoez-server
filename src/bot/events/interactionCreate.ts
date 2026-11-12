import {
  ActionRowBuilder,
  ChannelType,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ModalActionRowComponentBuilder,
} from 'discord.js';
import { db } from '@/db';
import { privateRooms } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { handleMute, handleDelete, handleStats } from '../commands/handlers';
import { handleAnonymousSlash, handleAvatar, handle8Ball, handleRoll, postAnonymousMessage } from '../commands/fun';
import { handlePlay, handleQueue, handleSkip, handleStop } from '../commands/music';
import { handleSetup } from '../commands/setup';
import { getCachedConfig } from '../guild-config-cache';
import { getPrivateRoom } from '../private-room-cache';

export async function handleInteraction(interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'сетап') {
      if (!interaction.guild) return;
      await interaction.deferReply({ ephemeral: true });
      try {
        await handleSetup(interaction.guild);
        await interaction.editReply('✅ Настройка завершена! Каналы и роли созданы.');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await interaction.editReply(`❌ Ошибка при настройке: ${message}`).catch(() => {});
      }
      return;
    }

    const musicCommands = ['музыка', 'скип', 'стоп', 'очередь'];
    if (musicCommands.includes(commandName) && interaction.guild) {
      let config = null;
      try {
        const { db } = await import('@/db');
        const { guildConfigs } = await import('@/db/schema');
        config = await db.query.guildConfigs.findFirst({
          where: eq(guildConfigs.guildId, interaction.guild.id),
        });
      } catch {
        config = getCachedConfig(interaction.guild.id);
      }
      if (!config) config = getCachedConfig(interaction.guild.id);

      if (config?.musicChannelId && interaction.channelId !== config.musicChannelId) {
        return interaction.reply({
          content: `❌ Команды музыки можно использовать только в канале <#${config.musicChannelId}>!`,
          ephemeral: true,
        });
      }
    }

    if (commandName === 'муте') return handleMute(interaction);
    if (commandName === 'делит') return handleDelete(interaction);
    if (commandName === 'стата') return handleStats(interaction);
    if (commandName === 'музыка') return handlePlay(interaction);
    if (commandName === 'скип') return handleSkip(interaction);
    if (commandName === 'стоп') return handleStop(interaction);
    if (commandName === 'очередь') return handleQueue(interaction);
    if (commandName === 'анон') return handleAnonymousSlash(interaction);
    if (commandName === 'ролл') return handleRoll(interaction);
    if (commandName === 'шар') return handle8Ball(interaction);
    if (commandName === 'аватар') return handleAvatar(interaction);
  }

  if (interaction.isButton()) {
    const { customId, member, guild, channelId } = interaction;

    if (customId === 'anon_open') {
      const modal = new ModalBuilder().setCustomId('modal_anon_send').setTitle('💗 Анонимное сообщение');
      const target = new TextInputBuilder()
        .setCustomId('anon_target')
        .setLabel('Кому (упоминание, ник или ID)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setRequired(true);
      const message = new TextInputBuilder()
        .setCustomId('anon_message')
        .setLabel('Сообщение')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(800)
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(target),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(message),
      );
      return interaction.showModal(modal);
    }

    if (!customId.startsWith('room_')) return;
    if (!guild || !channelId || !member) return;

    let room = null;
    try {
      room = await db.query.privateRooms.findFirst({
        where: eq(privateRooms.channelId, channelId),
      });
    } catch {
      room = getPrivateRoom(channelId);
    }
    if (!room) room = getPrivateRoom(channelId);

    if (!room || room.ownerId !== member.user.id) {
      return interaction.reply({ content: '❌ Вы не владелец этой комнаты!', ephemeral: true });
    }

    const channel = guild.channels.cache.get(channelId) as any;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return interaction.reply({ content: '❌ Канал не найден.', ephemeral: true });
    }

    switch (customId) {
      case 'room_rename': {
        const modal = new ModalBuilder().setCustomId('modal_room_rename').setTitle('✏️ Изменить название');
        const input = new TextInputBuilder()
          .setCustomId('new_name')
          .setLabel('Новое название')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(32);
        modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'room_lock': {
        const isLocked = channel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.Connect);
        await channel.permissionOverwrites.edit(guild.id, { Connect: isLocked ? null : false });
        return interaction.reply({ content: isLocked ? '🔓 Комната открыта' : '🔒 Комната закрыта', ephemeral: true });
      }
      case 'room_limit': {
        const modal = new ModalBuilder().setCustomId('modal_room_limit').setTitle('👥 Изменить лимит');
        const input = new TextInputBuilder()
          .setCustomId('new_limit')
          .setLabel('Лимит (0-99, 0 = без лимита)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(2);
        modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'room_visibility': {
        const isHidden = channel.permissionOverwrites.cache.get(guild.id)?.deny.has(PermissionFlagsBits.ViewChannel);
        await channel.permissionOverwrites.edit(guild.id, { ViewChannel: isHidden ? null : false });
        return interaction.reply({ content: isHidden ? '👁️ Комната теперь видна' : '🙈 Комната скрыта', ephemeral: true });
      }
      case 'room_ban': {
        const modal = new ModalBuilder().setCustomId('modal_room_ban').setTitle('🚫 Бан пользователя');
        const input = new TextInputBuilder()
          .setCustomId('ban_user_id')
          .setLabel('ID пользователя для бана')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Правый клик → Скопировать ID')
          .setMaxLength(20);
        modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'room_kick': {
        const modal = new ModalBuilder().setCustomId('modal_room_kick').setTitle('⚡ Выгнать пользователя');
        const input = new TextInputBuilder()
          .setCustomId('kick_user_id')
          .setLabel('ID пользователя для кика')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Правый клик → Скопировать ID')
          .setMaxLength(20);
        modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
        return interaction.showModal(modal);
      }
      case 'room_mute': {
        const modal = new ModalBuilder().setCustomId('modal_room_mute').setTitle('🎙️ Мут пользователя');
        const input = new TextInputBuilder()
          .setCustomId('mute_user_id')
          .setLabel('ID пользователя для мута')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Правый клик → Скопировать ID')
          .setMaxLength(20);
        modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(input));
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
          .setColor(0x8b5cf6);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      default:
        return interaction.reply({ content: '❓ Неизвестная кнопка.', ephemeral: true });
    }
  }

  if (interaction.isModalSubmit()) {
    const { customId, guild, channelId } = interaction;

    if (customId === 'modal_anon_send') {
      let targetLabel = interaction.fields.getTextInputValue('anon_target');
      const message = interaction.fields.getTextInputValue('anon_message');
      
      // If user typed ID or name, try to resolve it to ping them properly
      if (/^\d{17,20}$/.test(targetLabel)) {
          targetLabel = `<@${targetLabel}>`;
      }

      try {
        await postAnonymousMessage(interaction.guild, targetLabel, message);
        return interaction.reply({ content: '✅ Анонимка отправлена.', ephemeral: true });
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        return interaction.reply({ content: `❌ ${text}`, ephemeral: true });
      }
    }

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
      const limit = Number.parseInt(interaction.fields.getTextInputValue('new_limit'), 10);
      if (Number.isNaN(limit) || limit < 0 || limit > 99) {
        return interaction.reply({ content: '❌ Лимит должен быть от 0 до 99.', ephemeral: true });
      }
      try {
        const channel = guild?.channels.cache.get(channelId!) as any;
        await channel?.setUserLimit(limit);
        return interaction.reply({ content: limit === 0 ? '👥 Лимит снят' : `👥 Лимит: **${limit}**`, ephemeral: true });
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
        return interaction.reply({ content: '❌ Не удалось забанить. Проверь ID.', ephemeral: true });
      }
    }

    if (customId === 'modal_room_kick') {
      const targetId = interaction.fields.getTextInputValue('kick_user_id').trim();
      try {
        const channel = guild?.channels.cache.get(channelId!) as any;
        const targetMember = channel?.members?.get(targetId);
        if (!targetMember) {
          return interaction.reply({ content: '❌ Пользователь не в этом канале.', ephemeral: true });
        }
        await targetMember.voice.disconnect();
        return interaction.reply({ content: `⚡ Пользователь <@${targetId}> выгнан.`, ephemeral: true });
      } catch {
        return interaction.reply({ content: '❌ Не удалось кикнуть. Проверь ID.', ephemeral: true });
      }
    }

    if (customId === 'modal_room_mute') {
      const targetId = interaction.fields.getTextInputValue('mute_user_id').trim();
      try {
        const channel = guild?.channels.cache.get(channelId!) as any;
        const targetMember = channel?.members?.get(targetId);
        if (!targetMember) {
          return interaction.reply({ content: '❌ Пользователь не в этом канале.', ephemeral: true });
        }
        const isMuted = targetMember.voice.serverMute;
        await targetMember.voice.setMute(!isMuted);
        return interaction.reply({
          content: isMuted ? `🎙️ <@${targetId}> размучен.` : `🔇 <@${targetId}> замучен.`,
          ephemeral: true,
        });
      } catch {
        return interaction.reply({ content: '❌ Не удалось замутить. Проверь ID.', ephemeral: true });
      }
    }
  }
}
