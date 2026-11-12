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
    OverwriteType,
} from 'discord.js';
import { db } from '@/db';
import { guildConfigs } from '@/db/schema';

export async function handleSetup(guild: Guild) {
    const botId = guild.client.user!.id;

    // ══════════════════════════════════════════
    //  1. ROLES
    // ══════════════════════════════════════════

    const staffRoles = [
        {
            name: '👑 Король',
            color: '#FFD700' as ColorResolvable,
            permissions: [PermissionFlagsBits.Administrator],
            hoist: true,
            position: 10,
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
            position: 9,
        },
    ];

    const funRoles = [
        { name: '🎭 Тусовщик',     color: '#FF6B9D' as ColorResolvable },
        { name: '🌙 Ночной Дозор', color: '#2C2137' as ColorResolvable },
        { name: '🎮 Геймер',       color: '#00D26A' as ColorResolvable },
        { name: '🎨 Творец',       color: '#E040FB' as ColorResolvable },
        { name: '💀 Легенда',      color: '#B0BEC5' as ColorResolvable },
        { name: '🔥 Токсик',       color: '#FF3D00' as ColorResolvable },
        { name: '🐱 Котолюб',      color: '#FFAB40' as ColorResolvable },
        { name: '🤡 Клоун',        color: '#FFEE58' as ColorResolvable },
        { name: '🧠 Мудрец',       color: '#7C4DFF' as ColorResolvable },
        { name: '💎 OG',           color: '#00E5FF' as ColorResolvable },
    ];

    const createdStaffRoles = [];
    for (const rd of staffRoles) {
        let role = guild.roles.cache.find(r => r.name === rd.name);
        if (!role) {
            role = await guild.roles.create({
                name: rd.name,
                color: rd.color,
                permissions: rd.permissions,
                hoist: rd.hoist,
            });
        }
        createdStaffRoles.push(role);
    }

    for (const rd of funRoles) {
        const exists = guild.roles.cache.find(r => r.name === rd.name);
        if (!exists) {
            await guild.roles.create({ name: rd.name, color: rd.color, permissions: [], hoist: false });
        }
    }

    const kingRole   = createdStaffRoles[0];
    const almostRole = createdStaffRoles[1];

    // ══════════════════════════════════════════
    //  2. CATEGORY
    // ══════════════════════════════════════════

    const category = await guild.channels.create({
        name: '🌟 COMMUNITY',
        type: ChannelType.GuildCategory,
    });

    // ══════════════════════════════════════════
    //  3. TEXT CHANNELS
    // ══════════════════════════════════════════

    // ── 💬 Общий чат ──
    const generalChat = await guild.channels.create({
        name: '💬・чатик',           // ← ИСПРАВЛЕНО: чатик (не чятик)
        type: ChannelType.GuildText,
        parent: category.id,
    });

    // ── 🔔 Участники (только бот может писать) ──
    const welcomeChannel = await guild.channels.create({
        name: '🔔・участники',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Уведомления о новых участниках сервера 🎉',
        permissionOverwrites: [
            { id: guild.id,  deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
            { id: botId,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        ],
    });

    // ── 🤖 Команды (только слеш-команды) ──
    const commandsChannel = await guild.channels.create({
        name: '🤖・команды',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '⚡ Только для команд бота. Обычные сообщения удаляются.',
    });

    // ── 🎵 Музыка (для управления музыкой) ──
    const musicChannel = await guild.channels.create({
        name: '🎵・музыка',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '🎧 /музыка <название> • /скип • /стоп • /очередь',
    });

    // ── 📋 Voice logs (скрыт, только модераторы и бот) ──
    // CRITICAL: bot MUST have explicit SendMessages + EmbedLinks here
    const voiceLogs = await guild.channels.create({
        name: '📋・voice-logs',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            // Everyone: cannot see
            {
                id: guild.id,
                type: OverwriteType.Role,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            // Bot: can see AND send (this is the critical fix)
            {
                id: botId,
                type: OverwriteType.Member,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.ReadMessageHistory,
                ],
            },
            // King: can see
            {
                id: kingRole.id,
                type: OverwriteType.Role,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
            },
            // Almost King: can see
            {
                id: almostRole.id,
                type: OverwriteType.Role,
                allow: [PermissionFlagsBits.ViewChannel],
            },
        ],
    });

    // ── 📌 Правила ──
    const rulesChannel = await guild.channels.create({
        name: '📌・правила',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
            { id: botId,    allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        ],
    });

    // ── 🎁 Гивэвэи ──
    await guild.channels.create({
        name: '🎁・гивэвэи',
        type: ChannelType.GuildText,
        parent: category.id,
    });

    // ── 📸 Медиа ──
    await guild.channels.create({
        name: '📸・медиа',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Фото, видео, мемы — всё сюда!',
    });

    // ══════════════════════════════════════════
    //  4. FORUM — ИДЕИ
    // ══════════════════════════════════════════

    try {
        await guild.channels.create({
            name: '💡・идеи',
            type: ChannelType.GuildForum,
            parent: category.id,
            topic: 'Предлагай идеи для сервера! Нажми ➕',
            defaultForumLayout: ForumLayoutType.ListView,
            availableTags: [
                { name: '💡 Идея!',              moderated: false },
                { name: '❤️ Стикер/эмодзи',     moderated: false },
                { name: '✅ Выполнено/ожидание', moderated: true  },
                { name: '🐛 Баг',                moderated: false },
                { name: '🎮 Мини-игра',           moderated: false },
            ],
        });
    } catch {
        await guild.channels.create({ name: '💡・идеи', type: ChannelType.GuildText, parent: category.id });
    }

    // ══════════════════════════════════════════
    //  5. VOICE CHANNELS
    // ══════════════════════════════════════════

    await guild.channels.create({ name: '🔊 Lobby', type: ChannelType.GuildVoice, parent: category.id });

    for (let i = 1; i <= 4; i++) {
        await guild.channels.create({ name: `🔉 Lobby 30 #${i}`, type: ChannelType.GuildVoice, userLimit: 30, parent: category.id });
    }

    await guild.channels.create({ name: '🎧 Музыка', type: ChannelType.GuildVoice, parent: category.id });
    await guild.channels.create({ name: '🎲 Игры', type: ChannelType.GuildVoice, parent: category.id });

    const generator = await guild.channels.create({ name: '➕ Создать Комнату', type: ChannelType.GuildVoice, parent: category.id });

    // ══════════════════════════════════════════
    //  6. SAVE CONFIG
    // ══════════════════════════════════════════

    await db.insert(guildConfigs).values({
        guildId: guild.id,
        logsChannelId:    voiceLogs.id,
        generatorChannelId: generator.id,
        categoryId:       category.id,
        welcomeChannelId: welcomeChannel.id,
        commandsChannelId: commandsChannel.id,
        musicChannelId:   musicChannel.id,
    }).onConflictDoUpdate({
        target: guildConfigs.guildId,
        set: {
            logsChannelId:     voiceLogs.id,
            generatorChannelId: generator.id,
            categoryId:        category.id,
            welcomeChannelId:  welcomeChannel.id,
            commandsChannelId: commandsChannel.id,
            musicChannelId:    musicChannel.id,
        },
    });

    // ══════════════════════════════════════════
    //  7. EMBEDS IN CHANNELS
    // ══════════════════════════════════════════

    // Control panel
    const controlEmbed = new EmbedBuilder()
        .setTitle('🎮 Управление приватной комнатой')
        .setDescription(
            'Зайди в **➕ Создать Комнату** — бот создаст твой голосовой канал.\n\n' +
            '✏️ — изменить название\n🔒 — закрыть / открыть\n🚫 — бан\n⚡ — кик\n' +
            '👥 — изменить лимит\n👁️ — скрыть / показать\n🎙️ — мут\nℹ️ — инфо\n\n' +
            '**Работает только у владельца.** Когда комната опустеет — удалится.'
        )
        .setColor(0x8B5CF6)
        .setFooter({ text: 'Appoez Bot' });

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
    await generalChat.send({ embeds: [controlEmbed], components: [row1, row2] });

    // Rules embed
    const rulesEmbed = new EmbedBuilder()
        .setTitle('📌 Правила сервера')
        .setDescription(
            '**1.** Уважай других участников\n' +
            '**2.** Не спамь и не флудь\n' +
            '**3.** Не используй оскорбления\n' +
            '**4.** Реклама запрещена\n' +
            '**5.** Слушайся администрацию\n' +
            '**6.** Контент 18+ запрещён\n' +
            '**7.** Нарушение правил = бан\n\n' +
            '_Приятного общения! 💜_'
        )
        .setColor(0xF59E0B)
        .setFooter({ text: 'Appoez Community' });
    await rulesChannel.send({ embeds: [rulesEmbed] });

    // Commands channel info
    const cmdEmbed = new EmbedBuilder()
        .setTitle('🤖 Команды бота')
        .setDescription(
            '`/музыка <запрос>` — включить трек\n' +
            '`/скип` — пропустить\n' +
            '`/стоп` — остановить\n' +
            '`/очередь` — показать очередь\n' +
            '`/стата [user]` — статистика\n' +
            '`/муте <user> <время>` — мут\n' +
            '`/сетап` — настройка сервера _(только админы)_'
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Пиши команды здесь! Обычные сообщения удаляются.' });
    await commandsChannel.send({ embeds: [cmdEmbed] });

    // Music channel info
    const musicEmbed = new EmbedBuilder()
        .setTitle('🎵 Музыкальный канал')
        .setDescription(
            '**Как включить музыку:**\n' +
            '1️⃣ Зайди в голосовой канал 🎧 **Музыка**\n' +
            '2️⃣ Напиши `/музыка <название или ссылка>` в этом канале\n\n' +
            '**Поддерживается:** YouTube, SoundCloud, Spotify _(поиск)_, прямые ссылки'
        )
        .setColor(0xE040FB)
        .setFooter({ text: 'Appoez Bot • Музыка' });
    await musicChannel.send({ embeds: [musicEmbed] });

    // Welcome pin
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🔔 Канал участников')
        .setDescription('Здесь появляются уведомления когда кто-то заходит на сервер 🎉')
        .setColor(0x2ecc71);
    await welcomeChannel.send({ embeds: [welcomeEmbed] });

    // Voice logs startup message
    try {
        await voiceLogs.send({
            embeds: [new EmbedBuilder()
                .setTitle('📋 Лог голосовых каналов запущен')
                .setDescription('Здесь будут появляться события голосовых каналов.')
                .setColor(0x5865F2)
                .setTimestamp()]
        });
        console.log('[setup] ✅ Voice log startup message sent successfully');
    } catch (err) {
        console.error('[setup] ❌ Could not send startup message to voice-logs:', err);
    }

    return { generalChat, voiceLogs, generator, welcomeChannel, commandsChannel, musicChannel };
}
