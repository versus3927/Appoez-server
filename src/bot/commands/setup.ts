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

    // ── 1. Roles ──
    const roleDefs = [
        { name: '👑 Король', color: '#FFD700' as ColorResolvable, permissions: [PermissionFlagsBits.Administrator] },
        { name: '⚔️ Почти Король', color: '#4169E1' as ColorResolvable, permissions: [PermissionFlagsBits.ManageMessages] },
        { name: '🧟 Гуль', color: '#DC143C' as ColorResolvable, permissions: [] as bigint[] },
        { name: '🐸 Пупоез', color: '#2ECC71' as ColorResolvable, permissions: [] as bigint[] },
    ];

    const createdRoles = [];
    for (const rd of roleDefs) {
        let role = guild.roles.cache.find(r => r.name === rd.name);
        if (!role) {
            role = await guild.roles.create({
                name: rd.name,
                color: rd.color,
                permissions: rd.permissions,
            });
        }
        createdRoles.push(role);
    }

    const kingRole = createdRoles[0];
    const almostKingRole = createdRoles[1];

    // ── 2. Category ──
    const category = await guild.channels.create({
        name: '🌟 COMMUNITY',
        type: ChannelType.GuildCategory,
    });

    // ── 3. Text Channels ──
    const generalChat = await guild.channels.create({
        name: '💬・чятик',
        type: ChannelType.GuildText,
        parent: category.id,
    });

    const welcomeChannel = await guild.channels.create({
        name: '🔔・участники',
        type: ChannelType.GuildText,
        parent: category.id,
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

    // ── 4. Forum Channel (идеи) ──
    let ideasChannel = null;
    try {
        ideasChannel = await guild.channels.create({
            name: '💡・идеи',
            type: ChannelType.GuildForum,
            parent: category.id,
            topic: 'Предлагай свои идеи для сервера! Нажми ➕ чтобы создать пост.',
            defaultForumLayout: ForumLayoutType.ListView,
            availableTags: [
                { name: '💡 Идея!', moderated: false },
                { name: '❤️ Стикер/эмодзи', moderated: false },
                { name: '✅ Выполнено/ожидание', moderated: true },
                { name: '🐛 Баг', moderated: false },
                { name: '🎮 Мини-игра', moderated: false },
            ],
        });
    } catch (err) {
        console.warn('[setup] Could not create forum channel (requires Community server):', err);
        // Fallback: create a regular text channel for ideas
        ideasChannel = await guild.channels.create({
            name: '💡・идеи',
            type: ChannelType.GuildText,
            parent: category.id,
            topic: 'Предлагай свои идеи для сервера!',
        });
    }

    // ── 5. Voice Channels ──
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
        name: '🎵 Музыка',
        type: ChannelType.GuildVoice,
        parent: category.id,
    });

    const generator = await guild.channels.create({
        name: '➕ Создать Комнату',
        type: ChannelType.GuildVoice,
        parent: category.id,
    });

    // ── 6. Save config to DB ──
    await db.insert(guildConfigs).values({
        guildId: guild.id,
        logsChannelId: voiceLogs.id,
        generatorChannelId: generator.id,
        categoryId: category.id,
    }).onConflictDoUpdate({
        target: guildConfigs.guildId,
        set: {
            logsChannelId: voiceLogs.id,
            generatorChannelId: generator.id,
            categoryId: category.id,
        },
    });

    // ── 7. Control panel embed ──
    const embed = new EmbedBuilder()
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
            'Когда комната опустеет — она удалится автоматически.'
        )
        .setColor('#8B5CF6')
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

    await generalChat.send({ embeds: [embed], components: [row1, row2] });

    // ── 8. Welcome message in welcome channel ──
    const welcomeEmbed = new EmbedBuilder()
        .setTitle('🔔 Добро пожаловать!')
        .setDescription(
            'Здесь будут отображаться новые участники сервера.\n' +
            'Настрой системный канал сервера на этот канал для уведомлений о входах.'
        )
        .setColor('#F59E0B');

    await welcomeChannel.send({ embeds: [welcomeEmbed] });

    return { generalChat, voiceLogs, generator, ideasChannel, welcomeChannel };
}
