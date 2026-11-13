import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  ForumLayoutType, PermissionFlagsBits, type ColorResolvable, type Guild,
} from 'discord.js';
import { setCachedConfig } from '../guild-config-cache';

export async function handleSetup(guild: Guild) {
  const botId = guild.client.user!.id;
  const P = PermissionFlagsBits;

  // Helper: readonly for everyone, bot can send
  const readOnly = (extra: any[] = []) => [
    { id: guild.id, deny: [P.SendMessages] },
    { id: botId, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] },
    ...extra,
  ];

  // ── ROLES ──
  const staff = [
    { name: '👑 Король', color: '#FFD700' as ColorResolvable, permissions: [P.Administrator], hoist: true },
    { name: '⚔️ Почти Король', color: '#4169E1' as ColorResolvable, permissions: [P.ManageChannels, P.ManageMessages, P.ManageRoles, P.KickMembers, P.BanMembers, P.ModerateMembers, P.MuteMembers, P.DeafenMembers, P.MoveMembers, P.ManageNicknames, P.ViewAuditLog, P.MentionEveryone], hoist: true },
  ];
  const fun = [
    { name: '🎭 Тусовщик', color: '#FF6B9D' as ColorResolvable }, { name: '🌙 Ночной Дозор', color: '#5C6BC0' as ColorResolvable },
    { name: '🎮 Геймер', color: '#00D26A' as ColorResolvable }, { name: '🎨 Творец', color: '#E040FB' as ColorResolvable },
    { name: '💀 Легенда', color: '#B0BEC5' as ColorResolvable }, { name: '🔥 Токсик', color: '#FF3D00' as ColorResolvable },
    { name: '🐱 Котолюб', color: '#FFAB40' as ColorResolvable }, { name: '🤡 Клоун', color: '#FFEE58' as ColorResolvable },
    { name: '🧠 Мудрец', color: '#7C4DFF' as ColorResolvable }, { name: '💎 OG', color: '#00E5FF' as ColorResolvable },
    { name: '🌟 Элита', color: '#FFF176' as ColorResolvable }, { name: '🌈 Оптимист', color: '#81C784' as ColorResolvable },
  ];

  const createdStaff = [];
  for (const d of staff) { let r = guild.roles.cache.find(x => x.name === d.name); if (!r) r = await guild.roles.create({ name: d.name, color: d.color, permissions: d.permissions, hoist: d.hoist }); createdStaff.push(r); }
  for (const d of fun) { if (!guild.roles.cache.find(x => x.name === d.name)) await guild.roles.create({ name: d.name, color: d.color, permissions: [], hoist: false }); }
  const kingRole = createdStaff[0];

  // ── CATEGORIES ──
  const catWelcome = await guild.channels.create({ name: '🧊・Welcome', type: ChannelType.GuildCategory });
  const catChat = await guild.channels.create({ name: '🤍・Общение', type: ChannelType.GuildCategory });
  const catInteresting = await guild.channels.create({ name: '🍀・Интересное', type: ChannelType.GuildCategory });
  const catService = await guild.channels.create({ name: '🛠️・Сервис', type: ChannelType.GuildCategory });
  const catVoice = await guild.channels.create({ name: '🎧・Голосовые', type: ChannelType.GuildCategory });

  // ── CHANNELS ──
  // Welcome (readonly)
  const welcomeChannel = await guild.channels.create({ name: '🔔・участники', type: ChannelType.GuildText, parent: catWelcome.id, permissionOverwrites: readOnly() });

  // Chat (people CAN write here)
  const generalChat = await guild.channels.create({ name: '💬・чатик', type: ChannelType.GuildText, parent: catChat.id });

  // Interesting
  const mediaChannel = await guild.channels.create({ name: '💞・медиа', type: ChannelType.GuildText, parent: catInteresting.id });
  const anonymousChannel = await guild.channels.create({ name: '💗・анонимки', type: ChannelType.GuildText, parent: catInteresting.id, permissionOverwrites: readOnly() });
  try { await guild.channels.create({ name: '💡・идеи', type: ChannelType.GuildForum, parent: catInteresting.id, defaultForumLayout: ForumLayoutType.ListView, availableTags: [{ name: '💡 Идея!', moderated: false }, { name: '❤️ Стикер', moderated: false }, { name: '✅ Выполнено', moderated: true }, { name: '🐛 Баг', moderated: false }] }); } catch { await guild.channels.create({ name: '💡・идеи', type: ChannelType.GuildText, parent: catInteresting.id }); }

  // Service (all readonly)
  const rulesChannel = await guild.channels.create({ name: '📌・правила', type: ChannelType.GuildText, parent: catService.id, permissionOverwrites: readOnly() });
  const commandsChannel = await guild.channels.create({ name: '🤖・команды', type: ChannelType.GuildText, parent: catService.id, topic: '⚡ Только слеш-команды.' });
  const musicChannel = await guild.channels.create({ name: '🎵・музыка', type: ChannelType.GuildText, parent: catService.id, topic: '🎧 /музыка <название>' });
  const voiceLogs = await guild.channels.create({ name: '📋・voice-logs', type: ChannelType.GuildText, parent: catService.id, permissionOverwrites: [{ id: guild.id, deny: [P.ViewChannel] }, { id: botId, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] }, { id: kingRole.id, allow: [P.ViewChannel] }] });
  const messageLogs = await guild.channels.create({ name: '📝・message-logs', type: ChannelType.GuildText, parent: catService.id, permissionOverwrites: [{ id: guild.id, deny: [P.ViewChannel] }, { id: botId, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory] }, { id: kingRole.id, allow: [P.ViewChannel] }] });

  // Voice category: управление (text, above voice) → Создать Комнату → Lobby → etc
  const roomControl = await guild.channels.create({ name: '🎮・управление', type: ChannelType.GuildText, parent: catVoice.id, permissionOverwrites: readOnly([{ id: kingRole.id, allow: [P.SendMessages] }]) });
  const generator = await guild.channels.create({ name: '➕ Создать Комнату', type: ChannelType.GuildVoice, parent: catVoice.id });
  await guild.channels.create({ name: '🔊 Lobby', type: ChannelType.GuildVoice, parent: catVoice.id });
  for (let i = 1; i <= 4; i++) await guild.channels.create({ name: `🔉 Лобби #${i}`, type: ChannelType.GuildVoice, userLimit: 30, parent: catVoice.id });
  await guild.channels.create({ name: '🎧 Музыка', type: ChannelType.GuildVoice, parent: catVoice.id });
  await guild.channels.create({ name: '🎲 Игры', type: ChannelType.GuildVoice, parent: catVoice.id });

  // ── CONFIG ──
  const cfg = { guildId: guild.id, logsChannelId: voiceLogs.id, generatorChannelId: generator.id, categoryId: catVoice.id, welcomeChannelId: welcomeChannel.id, commandsChannelId: commandsChannel.id, musicChannelId: musicChannel.id };
  setCachedConfig(cfg);
  try { const { db } = await import('@/db'); const { guildConfigs } = await import('@/db/schema'); await db.insert(guildConfigs).values(cfg).onConflictDoUpdate({ target: guildConfigs.guildId, set: cfg }); } catch (e) { console.error('[setup] DB:', e); }

  // ── EMBEDS ──
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
  const anonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('anon_open').setLabel('Написать сообщение').setEmoji('💗').setStyle(ButtonStyle.Secondary),
  );

  await roomControl.send({ embeds: [new EmbedBuilder().setTitle('🏠 Приватная комната').setDescription('Зайди в **➕ Создать Комнату**\n\n✏️ название · 🔒 закрыть · 🚫 бан · ⚡ кик\n👥 лимит · 👁️ скрыть · 🎙️ мут · ℹ️ инфо').setColor(0x8b5cf6)], components: [row1, row2] });
  await rulesChannel.send({ embeds: [new EmbedBuilder().setTitle('📌 Правила').setDescription('**1.** Уважай других\n**2.** Не спамь\n**3.** Не оскорбляй\n**4.** Реклама запрещена\n**5.** Слушайся админов').setColor(0xf59e0b)] });
  await commandsChannel.send({ embeds: [new EmbedBuilder().setTitle('🤖 Команды').setDescription('`/музыка` · `/скип` · `/стоп` · `/очередь`\n`/анон` · `/стата` · `/ролл` · `/шар` · `/аватар`').setColor(0x5865f2)] });
  await musicChannel.send({ embeds: [new EmbedBuilder().setTitle('🎵 Музыка').setDescription('Зайди в 🎧 **Музыка** и напиши `/музыка <название>`\n\nПоиск музыки в SoundCloud.').setColor(0xe040fb)] });
  await welcomeChannel.send({ embeds: [new EmbedBuilder().setTitle('🔔 Участники').setDescription('Приветствия новых участников.').setColor(0x2ecc71)] });
  await anonymousChannel.send({ embeds: [new EmbedBuilder().setTitle('💗 Анонимки').setDescription('Нажми кнопку ниже и отправь анонимное сообщение.\nПолучатель будет **тегнут** и получит **ЛС от бота**.').setColor(0xec4899)], components: [anonRow] });
  try { await voiceLogs.send({ embeds: [new EmbedBuilder().setDescription('📋 **Voice-логи активны.**').setColor(0x5865f2).setTimestamp()] }); } catch {}
  try { await messageLogs.send({ embeds: [new EmbedBuilder().setDescription('📝 **Message-логи активны.** Здесь будут удаления и изменения сообщений.').setColor(0xf39c12).setTimestamp()] }); } catch {}

  return { generalChat, voiceLogs, generator };
}
