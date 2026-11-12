import {
    ChannelType,
    PermissionFlagsBits,
    Guild,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ColorResolvable,
    ForumLayoutType,
} from 'discord.js';
import { db } from '@/db';
import { guildConfigs } from '@/db/schema';

export async function handleSetup(guild: Guild) {
    const botId = guild.client.user!.id;

    // ══════════════════════════════════════════
    //  ROLES
    // ══════════════════════════════════════════
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
                PermissionFlagsBits.ManageGuildExpressions,
                PermissionFlagsBits.ViewAuditLog,
                PermissionFlagsBits.MentionEveryone,
                PermissionFlagsBits.PrioritySpeaker,
            ],
            hoist: true,
        },
    ];

    const funRoleDefs = [
        { name: '🎭 Тусовщик',     color: '#FF6B9D' as ColorResolvable },
        { name: '🌙 Ночной Дозор', color: '#5C6BC0' as ColorResolvable },
        { name: '🎮 Геймер',       color: '#00D26A' as ColorResolvable },
        { name: '🎨 Творец',       color: '#E040FB' as ColorResolvable },
        { name: '💀 Легенда',      color: '#B0BEC5' as ColorResolvable },
        { name: '🔥 Токсик',       color: '#FF3D00' as ColorResolvable },
        { name: '🐱 Котолюб',      color: '#FFAB40' as ColorResolvable },
        { name: '🤡 Клоун',        color: '#FFEE58' as ColorResolvable },
        { name: '🧠 Мудрец',       color: '#7C4DFF' as ColorResolvable },
        { name: '💎 OG',           color: '#00E5FF' as ColorResolvable },
    ];

    const createdStaff = [];
    for (const rd of staffRoleDefs) {
        let role = guild.roles.cache.find(r => r.name === rd.name);
        if (!role) {
            role = await guild.roles.create({ name: rd.name, color: rd.color, permissions: rd.permissions, hoist: rd.hoist });
        }
        createdStaff.push(role);
    }

    for (const rd of funRoleDefs) {
        if (!guild.roles.cache.find(r => r.name === rd.name)) {
            await guild.roles.create({ name: rd.name, color: rd.color, permissions: [], hoist: false });
        }
    }

    const kingRole   = createdStaff[0];
    const almostRole = createdStaff[1];

    // ══════════════════════════════════════════
    //  CATEGORY
    // ══════════════════════════════════════════
    const category = await guild.channels.create({ name: '🌟 COMMUNITY', type: ChannelType.GuildCategory });

    // ══════════════════════════════════════════
    //  TEXT CHANNELS
    // ══════════════════════════════════════════

    // 💬 General chat
    const generalChat = await guild.channels.create({ name: '💬・чатик', type: ChannelType.GuildText, parent: category.id });

    // 🔔 Welcome — bot sends, everyone reads
    const welcomeChannel = await guild.channels.create({
        name: '🔔・участники',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Уведомления о новых участниках 🎉',
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
            { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        ],
    });

    // 🤖 Commands channel
    const commandsChannel = await guild.channels.create({
        name: '🤖・команды',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '⚡ Только для команд бота. Обычные сообщения удаляются.',
    });

    // 🎵 Music channel
    const musicChannel = await guild.channels.create({
        name: '🎵・музыка',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '🎧 /музыка <название> • /скип • /стоп • /очередь',
    });

    // 📋 Voice logs — VISIBLE to all, SEND only bot
    // KEY FIX: NOT hidden anymore! Hidden channels require explicit Member overwrite
    // which is unreliable. Making it read-only for everyone works 100%.
    const voiceLogs = await guild.channels.create({
        name: '📋・voice-logs',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Логи голосовых каналов (только чтение)',
        permissionOverwrites: [
            // Everyone: can READ but cannot send
            { id: guild.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
            // Bot: can send
            { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ViewChannel] },
            // King: can send too
            { id: kingRole.id, allow: [PermissionFlagsBits.SendMessages] },
            // AlmostKing: read only
            { id: almostRole.id, allow: [PermissionFlagsBits.ViewChannel] },
        ],
    });

    // 📌 Rules — readonly
    const rulesChannel = await guild.channels.create({
        name: '📌・правила',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
            { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        ],
    });

    // 📸 Media
    await guild.channels.create({ name: '📸・медиа', type: ChannelType.GuildText, parent: category.id, topic: 'Фото, видео, мемы' });

    // ══════════════════════════════════════════
    //  FORUM — ИДЕИ
    // ══════════════════════════════════════════
    try {
        await guild.channels.create({
            name: '💡・идеи',
            type: ChannelType.GuildForum,
            parent: category.id,
            topic: 'Предлагай идеи для сервера!',
            defaultForumLayout: ForumLayoutType.ListView,
            availableTags: [
                { name: '💡 Идея!',              moderated: false },
                { name: '❤️ Стикер/эмодзи',     moderated: false },
                { name: '✅ Выполнено/ожидание', moderated: true  },
                { name: '🐛 Баг',                moderated: false },
                { name: '🎮 Мини-игра',          moderated: false },
            ],
        });
    } catch {
        await guild.channels.create({ name: '💡・идеи', type: ChannelType.GuildText, parent: category.id });
    }

    // ══════════════════════════════════════════
    //  VOICE CHANNELS
    // ══════════════════════════════════════════
    await guild.channels.create({ name: '🔊 Lobby', type: ChannelType.GuildVoice, parent: category.id });
    for (let i = 1; i <= 4; i++) {
        await guild.channels.create({ name: `🔉 Lobby 30 #${i}`, type: ChannelType.GuildVoice, userLimit: 30, parent: category.id });
    }
    await guild.channels.create({ name: '🎧 Музыка', type: ChannelType.GuildVoice, parent: category.id });
    await guild.channels.create({ name: '🎲 Игры', type: ChannelType.GuildVoice, parent: category.id });
    const generator = await guild.channels.create({ name: '➕ Создать Комнату', type: ChannelType.GuildVoice, parent: category.id });

    // ══════════════════════════════════════════
    //  SAVE CONFIG
    // ══════════════════════════════════════════
    await db.insert(guildConfigs).values({
        guildId: guild.id,
        logsChannelId: voiceLogs.id,
        generatorChannelId: generator.id,
        categoryId: category.id,
        welcomeChannelId: welcomeChannel.id,
        commandsChannelId: commandsChannel.id,
        musicChannelId: musicChannel.id,
    }).onConflictDoUpdate({
        target: guildConfigs.guildId,
        set: {
            logsChannelId: voiceLogs.id,
            generatorChannelId: generator.id,
            categoryId: category.id,
            welcomeChannelId: welcomeChannel.id,
            commandsChannelId: commandsChannel.id,
            musicChannelId: musicChannel.id,
        },
    });

    // ══════════════════════════════════════════
    //  SEND EMBEDS
    // ══════════════════════════════════════════

    // Control panel
    const ctrlEmbed = new EmbedBuilder()
        .setTitle('🎮 Управление приватной комнатой')
        .setDescription(
            'Зайди в **➕ Создать Комнату** — бот создаст твой голосовой канал.\n\n' +
            '✏️ — название · 🔒 — закрыть · 🚫 — бан · ⚡ — кик\n' +
            '👥 — лимит · 👁️ — скрыть · 🎙️ — мут · ℹ️ — инфо\n\n' +
            '**Работает только у владельца.** Опустеет — удалится.'
        )
        .setColor(0x8B5CF6);
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
    await generalChat.send({ embeds: [ctrlEmbed], components: [row1, row2] });

    // Rules
    await rulesChannel.send({ embeds: [new EmbedBuilder()
        .setTitle('📌 Правила сервера')
        .setDescription(
            '**1.** Уважай других участников\n**2.** Не спамь и не флудь\n' +
            '**3.** Не оскорбляй\n**4.** Реклама запрещена\n' +
            '**5.** Слушайся администрацию\n**6.** Контент 18+ запрещён\n\n' +
            '_Нарушение правил = мут / бан_ 💜'
        ).setColor(0xF59E0B)] });

    // Commands info
    await commandsChannel.send({ embeds: [new EmbedBuilder()
        .setTitle('🤖 Команды бота')
        .setDescription(
            '`/музыка <запрос>` — включить трек\n`/скип` — пропустить\n' +
            '`/стоп` — остановить\n`/очередь` — список треков\n' +
            '`/стата [user]` — статистика\n`/ролл` — кубик 1-100\n' +
            '`/шар <вопрос>` — магический шар\n`/аватар [user]` — аватарка\n' +
            '`/муте <user> <время>` — мут _(модераторы)_\n' +
            '`/сетап` — настройка _(только админы)_'
        ).setColor(0x5865F2)
        .setFooter({ text: 'Обычные сообщения удаляются автоматически!' })] });

    // Music info
    await musicChannel.send({ embeds: [new EmbedBuilder()
        .setTitle('🎵 Как включить музыку')
        .setDescription(
            '1️⃣ Зайди в голосовой 🎧 **Музыка**\n' +
            '2️⃣ Напиши `/музыка <название>` в этом канале\n\n' +
            '**Поддерживается:** YouTube, SoundCloud, Spotify, прямые ссылки'
        ).setColor(0xE040FB)] });

    // Welcome pin
    await welcomeChannel.send({ embeds: [new EmbedBuilder()
        .setTitle('🔔 Канал участников')
        .setDescription('Здесь появляются уведомления когда кто-то заходит на сервер 🎉')
        .setColor(0x2ecc71)] });

    // Voice logs test — if this succeeds, logs WILL work
    try {
        await voiceLogs.send({ embeds: [new EmbedBuilder()
            .setDescription('📋 **Логи голосовых каналов активны.** Теперь все входы/выходы будут отображаться здесь.')
            .setColor(0x5865F2).setTimestamp()] });
        console.log('[setup] ✅ Voice logs startup message sent — permissions are correct!');
    } catch (err) {
        console.error('[setup] ❌ Voice logs startup message FAILED:', err);
    }

    return { generalChat, voiceLogs, generator, welcomeChannel, commandsChannel, musicChannel };
}
