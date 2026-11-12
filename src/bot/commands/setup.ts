import {
    ChannelType, PermissionFlagsBits, Guild,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ColorResolvable, ForumLayoutType,
} from 'discord.js';
import { setCachedConfig } from '../guild-config-cache';

export async function handleSetup(guild: Guild) {
    const botId = guild.client.user!.id;

    // ── ROLES ──
    const staffRoleDefs = [
        { name: '👑 Король', color: '#FFD700' as ColorResolvable, permissions: [PermissionFlagsBits.Administrator], hoist: true },
        { name: '⚔️ Почти Король', color: '#4169E1' as ColorResolvable, permissions: [
            PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ModerateMembers,
            PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.MentionEveryone,
        ], hoist: true },
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
    ];

    const createdStaff = [];
    for (const rd of staffRoleDefs) {
        let role = guild.roles.cache.find(r => r.name === rd.name);
        if (!role) role = await guild.roles.create({ name: rd.name, color: rd.color, permissions: rd.permissions, hoist: rd.hoist });
        createdStaff.push(role);
    }
    for (const rd of funRoleDefs) {
        if (!guild.roles.cache.find(r => r.name === rd.name))
            await guild.roles.create({ name: rd.name, color: rd.color, permissions: [], hoist: false });
    }

    const kingRole = createdStaff[0], almostRole = createdStaff[1];

    // ── CATEGORY ──
    const category = await guild.channels.create({ name: '🌟 COMMUNITY', type: ChannelType.GuildCategory });

    // ── TEXT CHANNELS ──
    const generalChat = await guild.channels.create({ name: '💬・чатик', type: ChannelType.GuildText, parent: category.id });

    const welcomeChannel = await guild.channels.create({
        name: '🔔・участники', type: ChannelType.GuildText, parent: category.id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
            { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        ],
    });

    const commandsChannel = await guild.channels.create({
        name: '🤖・команды', type: ChannelType.GuildText, parent: category.id,
        topic: '⚡ Только слеш-команды. Обычные сообщения удаляются.',
    });

    const musicChannel = await guild.channels.create({
        name: '🎵・музыка', type: ChannelType.GuildText, parent: category.id,
        topic: '🎧 /музыка <название> • /скип • /стоп • /очередь',
    });

    const voiceLogs = await guild.channels.create({
        name: '📋・voice-logs', type: ChannelType.GuildText, parent: category.id,
        topic: 'Логи голосовых каналов (только чтение)',
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel] },
            { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ViewChannel] },
            { id: kingRole.id, allow: [PermissionFlagsBits.SendMessages] },
            { id: almostRole.id, allow: [PermissionFlagsBits.ViewChannel] },
        ],
    });

    const rulesChannel = await guild.channels.create({
        name: '📌・правила', type: ChannelType.GuildText, parent: category.id,
        permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.SendMessages] },
            { id: botId, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
        ],
    });

    await guild.channels.create({ name: '📸・медиа', type: ChannelType.GuildText, parent: category.id });

    // Forum
    try {
        await guild.channels.create({
            name: '💡・идеи', type: ChannelType.GuildForum, parent: category.id,
            defaultForumLayout: ForumLayoutType.ListView,
            availableTags: [
                { name: '💡 Идея!', moderated: false }, { name: '❤️ Стикер/эмодзи', moderated: false },
                { name: '✅ Выполнено', moderated: true }, { name: '🐛 Баг', moderated: false },
            ],
        });
    } catch { await guild.channels.create({ name: '💡・идеи', type: ChannelType.GuildText, parent: category.id }); }

    // ── VOICE CHANNELS ──
    await guild.channels.create({ name: '🔊 Lobby', type: ChannelType.GuildVoice, parent: category.id });
    for (let i = 1; i <= 4; i++)
        await guild.channels.create({ name: `🔉 Lobby 30 #${i}`, type: ChannelType.GuildVoice, userLimit: 30, parent: category.id });
    await guild.channels.create({ name: '🎧 Музыка', type: ChannelType.GuildVoice, parent: category.id });
    await guild.channels.create({ name: '🎲 Игры', type: ChannelType.GuildVoice, parent: category.id });
    const generator = await guild.channels.create({ name: '➕ Создать Комнату', type: ChannelType.GuildVoice, parent: category.id });

    // ── SAVE CONFIG ──
    const configData = {
        guildId: guild.id,
        logsChannelId: voiceLogs.id,
        generatorChannelId: generator.id,
        categoryId: category.id,
        welcomeChannelId: welcomeChannel.id,
        commandsChannelId: commandsChannel.id,
        musicChannelId: musicChannel.id,
    };

    // ALWAYS save to in-memory cache (works even without DB)
    setCachedConfig(configData);

    // Try to save to DB (may fail if DATABASE_URL is wrong)
    try {
        const { db } = await import('@/db');
        const { guildConfigs } = await import('@/db/schema');
        await db.insert(guildConfigs).values(configData).onConflictDoUpdate({
            target: guildConfigs.guildId,
            set: {
                logsChannelId: voiceLogs.id, generatorChannelId: generator.id, categoryId: category.id,
                welcomeChannelId: welcomeChannel.id, commandsChannelId: commandsChannel.id, musicChannelId: musicChannel.id,
            },
        });
        console.log('[setup] ✅ Config saved to DB');
    } catch (err) {
        console.error('[setup] ⚠️ DB save failed (using in-memory cache):', (err as Error).message?.slice(0, 100));
    }

    // ── EMBEDS ──
    const ctrlEmbed = new EmbedBuilder().setTitle('🎮 Управление приватной комнатой').setDescription(
        'Зайди в **➕ Создать Комнату**\n\n✏️ — название · 🔒 — закрыть · 🚫 — бан · ⚡ — кик\n👥 — лимит · 👁️ — скрыть · 🎙️ — мут · ℹ️ — инфо'
    ).setColor(0x8B5CF6);
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
    await rulesChannel.send({ embeds: [new EmbedBuilder().setTitle('📌 Правила').setDescription('**1.** Уважай других\n**2.** Не спамь\n**3.** Не оскорбляй\n**4.** Реклама запрещена\n**5.** Слушайся админов').setColor(0xF59E0B)] });
    await commandsChannel.send({ embeds: [new EmbedBuilder().setTitle('🤖 Команды').setDescription('`/музыка` · `/скип` · `/стоп` · `/очередь` · `/стата` · `/ролл` · `/шар` · `/аватар`').setColor(0x5865F2)] });
    await musicChannel.send({ embeds: [new EmbedBuilder().setTitle('🎵 Музыка').setDescription('1️⃣ Зайди в 🎧 **Музыка**\n2️⃣ Напиши `/музыка <название>`').setColor(0xE040FB)] });

    // Test voice-logs
    try {
        await voiceLogs.send({ embeds: [new EmbedBuilder().setDescription('📋 **Voice-логи активны!**').setColor(0x5865F2).setTimestamp()] });
        console.log('[setup] ✅ Voice-logs test message sent');
    } catch (err) { console.error('[setup] ❌ Voice-logs test failed:', err); }

    return { generalChat, voiceLogs, generator };
}
