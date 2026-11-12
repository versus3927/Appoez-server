import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const commands = [
    new SlashCommandBuilder()
        .setName('сетап')
        .setDescription('Настроить сервер (создать каналы, роли)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('муте')
        .setDescription('Замутить пользователя')
        .addUserOption(option => option.setName('user').setDescription('Пользователь').setRequired(true))
        .addStringOption(option => option.setName('duration').setDescription('Длительность (напр. 10m, 1h)').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Причина').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    new SlashCommandBuilder()
        .setName('делит')
        .setDescription('Удалить всё на сервере (Только владелец)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('стата')
        .setDescription('Показать статистику участника')
        .addUserOption(option => option.setName('user').setDescription('Пользователь').setRequired(false)),
    new SlashCommandBuilder()
        .setName('музыка')
        .setDescription('Включить музыку')
        .addStringOption(option => option.setName('query').setDescription('Название песни или ссылка').setRequired(true)),
    new SlashCommandBuilder()
        .setName('скип')
        .setDescription('Пропустить текущий трек'),
    new SlashCommandBuilder()
        .setName('стоп')
        .setDescription('Остановить и очистить очередь'),
    new SlashCommandBuilder()
        .setName('очередь')
        .setDescription('Показать текущую очередь'),
    // ── NEW FUN COMMANDS ──
    new SlashCommandBuilder()
        .setName('ролл')
        .setDescription('Бросить кубик (случайное число от 1 до 100)'),
    new SlashCommandBuilder()
        .setName('шар')
        .setDescription('Магический шар ответит на твой вопрос')
        .addStringOption(option => option.setName('question').setDescription('Твой вопрос').setRequired(true)),
    new SlashCommandBuilder()
        .setName('аватар')
        .setDescription('Показать аватарку пользователя')
        .addUserOption(option => option.setName('user').setDescription('Пользователь').setRequired(false)),
].map(command => command.toJSON());

export async function deployCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;

    if (!token || !clientId) {
        console.error('[commands] DISCORD_TOKEN or DISCORD_CLIENT_ID is missing');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('[commands] Refreshing application (/) commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log('[commands] Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('[commands] Failed to deploy commands:', error);
    }
}
