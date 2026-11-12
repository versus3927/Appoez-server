import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ForumLayoutType,
  PermissionFlagsBits,
  type ColorResolvable,
  type Guild,
} from 'discord.js';
import { setCachedConfig } from '../guild-config-cache';

export async function handleSetup(guild: Guild) {
  const botId = guild.client.user!.id;

  const staffRoleDefs = [
    {
      name: '👑 Король',
      color: '#FFD700' as ColorResolvable,
      permissions: [PermissionFlagsBits.Administrator],
      hoist: true,
    },
    {
      name: '⚔️ Почти Король',
      color: '#4169E1' as ColorResolvable,
      permissions: [
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.MentionEveryone,
      ],
      hoist: true,
    },
  ];

  const funRoleDefs = [
    { name: '🎭 Тусовщик', color: '#FF6B9D' as ColorResolvable },
    { name: '🌙 Ночной Дозор', color: '#5C6BC0' as ColorResolvable },
    { name: '🎮 Геймер', color: '#00D26A' as ColorResolvable },
    { name: '🎨 Творец', color: '#E040FB' as ColorResolvable },
    { name: '💀 Легенда', color: '#B0BEC5' as ColorResolvable },
    { name: '🔥 Токсик', color: '#FF3D00' as ColorResolvable },
    { name: '🐱 Котолюб', color: '#FFAB40' as ColorResolvable },
    { name: '🤡 Клоун', color: '#FFEE58' as ColorResolvable },
    { name: '🧠 Мудрец', color: '#7C4DFF' as ColorResolvable },
    { name: '💎 OG', color: '#00E5FF' as ColorResolvable },
    { name: '🌟 Элита', color: '#FFF176' as ColorResolvable },
    { name: '🌈 Оптимист', color: '#81C784' as ColorResolvable },
  ];

  const createdStaff = [];
  for (const def of staffRoleDefs) {
    let role = guild.roles.cache.find((item) => item.name === def.name);
    if (!role) {
      role = await guild.roles.create({
        name: def.name,
        color: def.color,
        permissions: def.permissions,
        hoist: def.hoist,
      });
    }
    createdStaff.push(role);
  }

  for (const def of funRoleDefs) {
    if (!guild.roles.cache.find((item) => item.name === def.name)) {
      await guild.roles.create({
        name: def.name,
        color: def.color,
        permissions: [],
        hoist: false,
      });
    }
  }

  const kingRole = createdStaff[0];
  const almostRole = createdStaff[1];

  const welcomeCategory = await guild.channels.create({
    name: '🧊・Welcome',
    type: ChannelType.GuildCategory,
  });

  const chatCategory = await guild.channels.create({
    name: '🤍・Общение',
    type: ChannelType.GuildCategory,
  });

  const interestingCategory = await guild.channels.create({
    name: '🍀・Интересное',
    type: ChannelType.GuildCategory,
  });

  const serviceCategory = await guild.channels.create({
    name: '🛠️・Сервис',
    type: ChannelType.GuildCategory,
  });

  const voiceCategory = await guild.channels.create({
    name: '🎧・Голосовые',
    type: ChannelType.GuildCategory,
  });

  const profileChannel = await guild.channels.create({
    name: '🧑‍🚀・профиль',
    type: ChannelType.GuildText,
    parent: welcomeCategory.id,
    topic: 'Расскажи немного о себе и познакомься с сервером.',
  });

  const welcomeChannel = await guild.channels.create({
    name: '🔔・участники',
    type: ChannelType.GuildText,
    parent: welcomeCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
      {
        id: botId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ],
  });

  const generalChat = await guild.channels.create({
    name: '💬・чатик',
    type: ChannelType.GuildText,
    parent: chatCategory.id,
  });

  const faqChannel = await guild.channels.create({
    name: '📚・faq',
    type: ChannelType.GuildText,
    parent: interestingCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });

  const rulesChannel = await guild.channels.create({
    name: '📌・правила',
    type: ChannelType.GuildText,
    parent: serviceCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });

  const commandsChannel = await guild.channels.create({
    name: '🤖・команды',
    type: ChannelType.GuildText,
    parent: serviceCategory.id,
    topic: '⚡ Только слеш-команды. Обычные сообщения удаляются.',
  });

  const musicChannel = await guild.channels.create({
    name: '🎵・музыка',
    type: ChannelType.GuildText,
    parent: serviceCategory.id,
    topic: '🎧 /музыка <название> • /скип • /стоп • /очередь',
  });

  const mediaChannel = await guild.channels.create({
    name: '💞・медиа',
    type: ChannelType.GuildText,
    parent: interestingCategory.id,
    topic: 'Фото, видео, мемы и всё красивое.',
  });

  const rolesChannel = await guild.channels.create({
    name: '💞・tag',
    type: ChannelType.GuildText,
    parent: interestingCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });

  const pollsChannel = await guild.channels.create({
    name: '❔・опросы',
    type: ChannelType.GuildText,
    parent: interestingCategory.id,
    topic: 'Обсуждения, голосования и опросы.',
  });

  const anonymousChannel = await guild.channels.create({
    name: '💗・анонимки',
    type: ChannelType.GuildText,
    parent: interestingCategory.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
    topic: 'Анонимные сообщения через кнопку ниже.',
  });

  const roomControlChannel = await guild.channels.create({
    name: '🎮・управление',
    type: ChannelType.GuildText,
    parent: serviceCategory.id,
    topic: 'Кнопки управления твоей приватной комнатой.',
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: kingRole.id, allow: [PermissionFlagsBits.SendMessages] },
    ],
  });

  const voiceLogs = await guild.channels.create({
    name: '📋・voice-logs',
    type: ChannelType.GuildText,
    parent: serviceCategory.id,
    topic: 'Логи голосовых каналов.',
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      {
        id: botId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      { id: kingRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      { id: almostRole.id, allow: [PermissionFlagsBits.ViewChannel] },
    ],
  });

  try {
    await guild.channels.create({
      name: '💡・идеи',
      type: ChannelType.GuildForum,
      parent: interestingCategory.id,
      topic: 'Предлагай идеи для сервера.',
      defaultForumLayout: ForumLayoutType.ListView,
      availableTags: [
        { name: '💡 Идея!', moderated: false },
        { name: '❤️ Стикер/эмодзи', moderated: false },
        { name: '✅ Выполнено', moderated: true },
        { name: '🐛 Баг', moderated: false },
        { name: '🎮 Мини-игра', moderated: false },
      ],
    });
  } catch {
    await guild.channels.create({
      name: '💡・идеи',
      type: ChannelType.GuildText,
      parent: interestingCategory.id,
    });
  }

  await guild.channels.create({ name: '🔊 Lobby', type: ChannelType.GuildVoice, parent: voiceCategory.id });
  for (let i = 1; i <= 4; i += 1) {
    await guild.channels.create({
      name: `🔉 Лобби #${i}`,
      type: ChannelType.GuildVoice,
      userLimit: 30,
      parent: voiceCategory.id,
    });
  }
  await guild.channels.create({ name: '🎧 Музыка', type: ChannelType.GuildVoice, parent: voiceCategory.id });
  await guild.channels.create({ name: '🎲 Игры', type: ChannelType.GuildVoice, parent: voiceCategory.id });
  const generator = await guild.channels.create({
    name: '➕ Создать Комнату',
    type: ChannelType.GuildVoice,
    parent: voiceCategory.id,
  });

  const configData = {
    guildId: guild.id,
    logsChannelId: voiceLogs.id,
    generatorChannelId: generator.id,
    categoryId: voiceCategory.id,
    welcomeChannelId: welcomeChannel.id,
    commandsChannelId: commandsChannel.id,
    musicChannelId: musicChannel.id,
  };

  setCachedConfig(configData);

  try {
    const { db } = await import('@/db');
    const { guildConfigs } = await import('@/db/schema');
    await db.insert(guildConfigs).values(configData).onConflictDoUpdate({
      target: guildConfigs.guildId,
      set: {
        logsChannelId: voiceLogs.id,
        generatorChannelId: generator.id,
        categoryId: voiceCategory.id,
        welcomeChannelId: welcomeChannel.id,
        commandsChannelId: commandsChannel.id,
        musicChannelId: musicChannel.id,
      },
    });
  } catch (error) {
    console.error('[setup] DB save failed:', error);
  }

  const roomEmbed = new EmbedBuilder()
    .setTitle('🏠 Управление приватной комнатой')
    .setDescription(
      'Зайди в **➕ Создать Комнату**\n\n' +
        '✏️ — название · 🔒 — закрыть · 🚫 — бан · ⚡ — кик\n' +
        '👥 — лимит · 👁️ — скрыть · 🎙️ — мут · ℹ️ — инфо',
    )
    .setColor(0x8b5cf6);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('room_rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('room_lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('room_ban').setEmoji('🚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('room_kick').setEmoji('⚡').setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('room_limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('room_visibility').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('room_mute').setEmoji('🎙️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('room_info').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
  );

  const anonEmbed = new EmbedBuilder()
    .setTitle('💗 Анонимки')
    .setDescription('Нажми кнопку ниже и отправь анонимное сообщение другому участнику сервера.')
    .setColor(0xec4899);

  const anonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('anon_open')
      .setLabel('Написать сообщение')
      .setEmoji('💗')
      .setStyle(ButtonStyle.Secondary),
  );

  await profileChannel.send({
    embeds: [new EmbedBuilder().setTitle('🧑‍🚀 Профиль').setDescription('Расскажи о себе: чем занимаешься, во что играешь, что любишь.').setColor(0x60a5fa)],
  });
  await faqChannel.send({
    embeds: [new EmbedBuilder().setTitle('📚 FAQ').setDescription('Здесь будут ответы на частые вопросы, полезные ссылки и подсказки для новичков.').setColor(0x10b981)],
  });
  await rolesChannel.send({
    embeds: [new EmbedBuilder().setTitle('💞 Фан-роли').setDescription(funRoleDefs.map((role) => `• ${role.name}`).join('\n')).setColor(0xf472b6)],
  });
  await rulesChannel.send({
    embeds: [new EmbedBuilder().setTitle('📌 Правила').setDescription('**1.** Уважай других\n**2.** Не спамь\n**3.** Не оскорбляй\n**4.** Реклама запрещена\n**5.** Слушайся админов').setColor(0xf59e0b)],
  });
  await commandsChannel.send({
    embeds: [new EmbedBuilder().setTitle('🤖 Команды').setDescription('`/музыка` · `/скип` · `/стоп` · `/очередь` · `/анон` · `/стата` · `/ролл` · `/шар` · `/аватар`').setColor(0x5865f2)],
  });
  await musicChannel.send({
    embeds: [new EmbedBuilder().setTitle('🎵 Музыка').setDescription('1️⃣ Зайди в 🎧 **Музыка**\n2️⃣ Напиши `/музыка <название>`').setColor(0xe040fb)],
  });
  await welcomeChannel.send({
    embeds: [new EmbedBuilder().setTitle('🔔 Канал участников').setDescription('Сюда бот будет отправлять приветствия новым участникам.').setColor(0x2ecc71)],
  });
  await roomControlChannel.send({ embeds: [roomEmbed], components: [row1, row2] });
  await anonymousChannel.send({ embeds: [anonEmbed], components: [anonRow] });

  try {
    await voiceLogs.send({ embeds: [new EmbedBuilder().setDescription('📋 **Voice-логи активны.**').setColor(0x5865f2).setTimestamp()] });
  } catch (error) {
    console.error('[setup] Voice-logs test failed:', error);
  }

  return { generalChat, voiceLogs, generator };
}
