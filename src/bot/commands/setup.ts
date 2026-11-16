import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  PermissionFlagsBits, type ChatInputCommandInteraction, type GuildTextBasedChannel,
} from 'discord.js';
import { setCachedConfig } from '../guild-config-cache';

/**
 * /сетап <channel>
 * Detects what the channel is by its name and configures it accordingly:
 *   - участники  → welcome channel (embed)
 *   - правила    → rules embed
 *   - команды    → commands embed
 *   - игры       → games channel config
 *   - музыка (text) → music channel embed
 *   - анонимки   → anonymous button embed
 *   - управление → private room control embed + buttons
 *   - voice-logs / message-logs → log activation embed
 *   - Создать Комнату → generator channel (config)
 *
 * Also saves channel IDs to guild config in DB.
 */
export async function handleSetup(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild!;
  const channel = interaction.options.getChannel('channel', true);
  const botId = guild.client.user!.id;
  const P = PermissionFlagsBits;

  const fetched = await guild.channels.fetch(channel.id).catch(() => null);
  if (!fetched) {
    return interaction.editReply('❌ Канал не найден.');
  }

  const name = fetched.name.toLowerCase();

  // ── Helpers ──
  const readOnly = (extra: any[] = []) => [
    { id: guild.id, deny: [P.SendMessages] },
    { id: botId, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks] },
    ...extra,
  ];

  // Load current config
  let cfg: Record<string, string | null> = { guildId: guild.id };
  try {
    const { db } = await import('@/db');
    const { guildConfigs } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const existing = await db.query.guildConfigs.findFirst({ where: eq(guildConfigs.guildId, guild.id) });
    if (existing) cfg = { ...existing };
  } catch { /* ignore */ }
  cfg.guildId = guild.id;

  const textChannel = fetched as GuildTextBasedChannel;
  let reply = '';

  // ── Pattern-matching by channel name ──

  if (name.includes('участники')) {
    cfg.welcomeChannelId = channel.id;
    await textChannel.send({ embeds: [new EmbedBuilder().setTitle('🔔 Участники').setDescription('Приветствия новых участников.').setColor(0x2ecc71)] });
    reply = `✅ Канал <#${channel.id}> настроен как **приветствия**.`;

  } else if (name.includes('правила')) {
    await textChannel.send({ embeds: [new EmbedBuilder().setTitle('📌 Правила').setDescription('**1.** Уважай других\n**2.** Не спамь\n**3.** Не оскорбляй\n**4.** Реклама запрещена\n**5.** Слушайся админов').setColor(0xf59e0b)] });
    reply = `✅ Канал <#${channel.id}> настроен как **правила**.`;

  } else if (name.includes('команды') || name.includes('команд')) {
    cfg.commandsChannelId = channel.id;
    await textChannel.send({ embeds: [new EmbedBuilder().setTitle('🤖 Команды').setDescription('`/музыка` · `/скип` · `/стоп` · `/очередь`\n`/анон` · `/стата` · `/ролл` · `/аватар`').setColor(0x5865f2)] });
    reply = `✅ Канал <#${channel.id}> настроен как **команды**.`;

  } else if (name.includes('игр')) {
    cfg.gamesChannelId = channel.id;
    await textChannel.send({ embeds: [new EmbedBuilder().setTitle('🎲 Игры').setDescription('Используй здесь игровые команды: `/ролл`, `/баланс`, `/охота`, `/рулетка`, `/дуэль`, `/виселица`, `/квиз`, `/стата`').setColor(0x9b59b6)] });
    reply = `✅ Канал <#${channel.id}> настроен как **игры**.`;

  } else if (name.includes('музыка') && fetched.type === ChannelType.GuildText) {
    cfg.musicChannelId = channel.id;
    await textChannel.send({ embeds: [new EmbedBuilder().setTitle('🎵 Музыка').setDescription('Зайди в голосовой канал и напиши `/музыка <название>`').setColor(0xe040fb)] });
    reply = `✅ Канал <#${channel.id}> настроен как **музыка**.`;

  } else if (name.includes('анонимк')) {
    const anonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('anon_open').setLabel('Написать сообщение').setEmoji('💗').setStyle(ButtonStyle.Secondary),
    );
    await textChannel.send({ embeds: [new EmbedBuilder().setTitle('💗 Анонимки').setDescription('Нажми кнопку ниже и отправь анонимное сообщение.\nПолучатель будет **тегнут** и получит **ЛС от бота**.').setColor(0xec4899)], components: [anonRow] });
    reply = `✅ Канал <#${channel.id}> настроен как **анонимки**.`;

  } else if (name.includes('управлени')) {
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
    await textChannel.send({ embeds: [new EmbedBuilder().setTitle('🏠 Приватная комната').setDescription('Зайди в **➕ Создать Комнату**\n\n✏️ название · 🔒 закрыть · 🚫 бан · ⚡ кик\n👥 лимит · 👁️ скрыть · 🎙️ мут · ℹ️ инфо').setColor(0x8b5cf6)], components: [row1, row2] });
    reply = `✅ Канал <#${channel.id}> настроен как **управление комнатами**.`;

  } else if (name.includes('voice-log') || name.includes('voice_log') || name.includes('войс-лог')) {
    cfg.logsChannelId = channel.id;
    try { await textChannel.send({ embeds: [new EmbedBuilder().setDescription('📋 **Voice-логи активны.**').setColor(0x5865f2).setTimestamp()] }); } catch {}
    reply = `✅ Канал <#${channel.id}> настроен как **voice-логи**.`;

  } else if (name.includes('message-log') || name.includes('message_log') || name.includes('сообщ-лог')) {
    try { await textChannel.send({ embeds: [new EmbedBuilder().setDescription('📝 **Message-логи активны.** Здесь будут удаления и изменения сообщений.').setColor(0xf39c12).setTimestamp()] }); } catch {}
    reply = `✅ Канал <#${channel.id}> настроен как **message-логи**.`;

  } else if (name.includes('создать') || name.includes('create')) {
    if (fetched.type !== ChannelType.GuildVoice) {
      return interaction.editReply('❌ Канал **Создать Комнату** должен быть голосовым.');
    }
    cfg.generatorChannelId = channel.id;
    cfg.categoryId = fetched.parentId ?? '';
    reply = `✅ Канал <#${channel.id}> настроен как **генератор приватных комнат**.`;

  } else if (name.includes('log') || name.includes('лог')) {
    cfg.logsChannelId = channel.id;
    try { await textChannel.send({ embeds: [new EmbedBuilder().setDescription('📋 **Логи активны.**').setColor(0x5865f2).setTimestamp()] }); } catch {}
    reply = `✅ Канал <#${channel.id}> настроен как **логи**.`;

  } else {
    return interaction.editReply(`❌ Не удалось определить тип канала **${fetched.name}**. Поддерживаемые названия: участники, правила, команды, музыка, анонимки, управление, voice-logs, message-logs, Создать Комнату.`);
  }

  // ── Save config ──
  setCachedConfig(cfg as any);
  try {
    const { db } = await import('@/db');
    const { guildConfigs } = await import('@/db/schema');
    await db.insert(guildConfigs).values(cfg as any).onConflictDoUpdate({ target: guildConfigs.guildId, set: cfg as any });
  } catch (e) {
    console.error('[setup] DB:', e);
  }

  return interaction.editReply(reply);
}
