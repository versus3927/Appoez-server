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
    //  1. ROLES
    // ══════════════════════════════════════════

    // Staff roles
    const staffRoles = [
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
            ],
            hoist: true,
        },
    ];

    // Fun roles — no permissions, just vibes
    const funRoles = [
        { name: '🎭 Тусовщик',       color: '#FF6B9D' as ColorResolvable },
        { name: '🌙 Ночной Дозор',   color: '#2C2137' as ColorResolvable },
        { name: '🎮 Геймер',          color: '#00D26A' as ColorResolvable },
        { name: '🎨 Творец',          color: '#E040FB' as ColorResolvable },
        { name: '💀 Легенда',         color: '#B0BEC5' as ColorResolvable },
        { name: '🔥 Токсик',          color: '#FF3D00' as ColorResolvable },
        { name: '🐱 Котолюб',         color: '#FFAB40' as ColorResolvable },
        { name: '🤡 Клоун',           color: '#FFEE58' as ColorResolvable },
        { name: '🧠 Мудрец',          color: '#7C4DFF' as ColorResolvable },
        { name: '💎 OG',              color: '#00E5FF' as ColorResolvable },
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
            await guild.roles.create({
                name: rd.name,
                color: rd.color,
                permissions: [],
                hoist: false,
            });
        }
    }

    const kingRole = createdStaffRoles[0];
    const almostKingRole = createdStaffRoles[1];

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

    const generalChat = await guild.channels.create({
        name: '💬・чятик',
        type: ChannelType.GuildText,
        parent: category.id,
    });

    // Канал для приветствий новых участников
    const welcomeChannel = await guild.channels.create({
        name: '🔔・участники',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Здесь появляются уведомления о новых участниках сервера 🎉',
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.SendMessages],
                allow: [PermissionFlagsBits.ViewChannel],
            },
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

    // Канал команд — только для бот-команд, обычные сообщения удаляются
    const commandsChannel = await guild.channels.create({
        name: '🤖・команды',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '⚡ Канал для команд бота. Пиши слеш-команды здесь! Обычные сообщения удаляются автоматически.',
    });

    // Канал музыки — для управления музыкой
    const musicChannel = await guild.channels.create({
        name: '🎵・музыка',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '🎧 Пиши /музыка <название> чтобы включить трек. Также: /скип, /стоп, /очередь',
    });

    const voiceLogs = await guild.channels.create({
        name: '📋・voice-logs',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: botId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.EmbedLinks,
                ],
            },
            {
                id: kingRole.id,
                allow: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: almostKingRole.id,
                allow: [PermissionFlagsBits.ViewChannel],
            },
        ],
    });

    // ══════════════════════════════════════════
    //  4. FORUM — ИДЕИ
    // ══════════════════════════════════════════

    try {
        await guild.channels.create({
            name: '💡・идеи',
            type: ChannelType.GuildForum,
            parent: category.id,
            topic: 'Предлагай идеи для сервера! Нажми ➕ чтобы создать пост.',
            defaultForumLayout: ForumLayoutType.ListView,
            availableTags: [
                { name: '💡 Идея!', moderated: false },
                { name: '❤️ Стикер/эмодзи', moderated: false },
                { name: '✅ Выполнено/ожидание', moderated: true },
                { name: '🐛 Баг', moderated: false },
                { name: '🎮 Мини-игра', moderated: false },
            ],
        });
    } catch {
        // Fallback for non-Community servers
        await guild.channels.create({
            name: '💡・идеи',
            type: ChannelType.GuildText,
            parent: category.id,
            topic: 'Предлагай идеи для сервера!',
        });
    }

    // ══════════════════════════════════════════
    //  5. VOICE CHANNELS
    // ══════════════════════════════════════════

    await guild.channels.create({
        name: '🔊 Lobby',
        type: ChannelType.GuildVoice,
        parent: category.id,
    });

    for (let i = 1; i <= 4; i++) {
        await guild.channels.create({
            name: `🔉 Lobby 30 #${i}`,
            type: ChannelType.GuildVoice,
            userLimit: 30,
            parent: category.id,
        });
    }

    await guild.channels.create({
        name: '🎧 Музыка',
        type: ChannelType.GuildVoice,
        parent: category.id,
    });

    const generator = await guild.channels.create({
        name: '➕ Создать Комнату',
        type: ChannelType.GuildVoice,
        parent: category.id,
    });

    // ══════════════════════════════════════════
    //  6. SAVE CONFIG
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
    //  7. EMBEDS
    // ══════════════════════════════════════════

    // Control panel in general chat
    const controlEmbed = new EmbedBuilder()
        .setTitle('🎮 Управление приватной комнатой')
        .setDescription(
            'Зайди в **➕ Создать Комнату** — бот создаст твой голосовой канал.\n\n' +
            '✏️ — изменить название\n' +
            '🔒 — закрыть / открыть\n' +
            '🚫 — бан / разбан\n' +
            '⚡ — выгнать пользователя\n' +
            '👥 — изменить лимит\n' +
            '👁️ — скрыть / показать\n' +
            '🎙️ — мут / размут\n' +
            'ℹ️ — информация о комнате\n\n' +
            '**Кнопки работают только у владельца.**\n' +
            'Когда комната опустеет — она удалится.'
        )
        .setColor(0x8B5CF6)
        .setFooter({ text: 'Appoez Bot • Community Server' });

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

    // Info embed in commands channel
    const cmdEmbed = new EmbedBuilder()
        .setTitle('🤖 Канал команд')
        .setDescription(
            'Этот канал только для **слеш-команд** бота.\n' +
            'Обычные сообщения удаляются автоматически.\n\n' +
            '**Доступные команды:**\n' +
            '`/музыка` — включить трек\n' +
            '`/скип` — пропустить\n' +
            '`/стоп` — остановить\n' +
            '`/очередь` — текущая очередь\n' +
            '`/стата` — статистика участника\n' +
            '`/муте` — замутить (модераторы)\n' +
            '`/сетап` — настройка сервера (админы)\n'
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'Appoez Bot • Пиши команды здесь!' });

    await commandsChannel.send({ embeds: [cmdEmbed] });

    // Info embed in music channel
    const musicEmbed = new EmbedBuilder()
        .setTitle('🎵 Музыкальный канал')
        .setDescription(
            'Управляй музыкой бота здесь!\n\n' +
            '**Команды:**\n' +
            '`/музыка <название или ссылка>` — добавить трек\n' +
            '`/скип` — пропустить текущий трек\n' +
            '`/стоп` — остановить и очистить очередь\n' +
            '`/очередь` — показать очередь\n\n' +
            '💡 Сначала зайди в голосовой канал 🎧 **Музыка**!'
        )
        .setColor(0xE040FB)
        .setFooter({ text: 'Appoez Bot • Музыка' });

    await musicChannel.send({ embeds: [musicEmbed] });

    // Welcome embed in welcome channel
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🔔 Канал участников')
        .setDescription(
            'Здесь появляются уведомления когда кто-то заходит на сервер.\n' +
            'Приветствуйте новичков! 🎉'
        )
        .setColor(0xF59E0B);

    await welcomeChannel.send({ embeds: [welcomeEmbed] });

    return { generalChat, voiceLogs, generator, welcomeChannel, commandsChannel, musicChannel };
}
