import { ChatInputCommandInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { player } from '../client';
import { useQueue } from 'discord-player';

export async function handlePlay(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString('query', true);
    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
        return interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const result = await player.play(member.voice.channel, query, {
            nodeOptions: {
                metadata: interaction,
                selfDeaf: true,
                leaveOnEmpty: true,
                leaveOnEmptyCooldown: 60_000,
                leaveOnEnd: true,
                leaveOnEndCooldown: 120_000,
            },
            requestedBy: interaction.user,
        });

        const { track } = result;

        const embed = new EmbedBuilder()
            .setTitle('🎶 Добавлено в очередь')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
                { name: '👤 Автор', value: track.author || 'Неизвестен', inline: true },
                { name: '⏱️ Длительность', value: track.duration || '?', inline: true },
            )
            .setThumbnail(track.thumbnail || null)
            .setColor(0x8B5CF6)
            .setFooter({ text: `Запросил: ${interaction.user.username}` });

        return interaction.editReply({ embeds: [embed] });
    } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[music] Play error:', errMsg);
        return interaction.editReply(`❌ Не удалось воспроизвести: ${errMsg}`);
    }
}

export async function handleSkip(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
        return interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
    }

    const queue = useQueue(interaction.guildId!);

    if (!queue || !queue.isPlaying()) {
        return interaction.reply({ content: '❌ Сейчас ничего не играет.', ephemeral: true });
    }

    try {
        const current = queue.currentTrack;
        queue.node.skip();
        return interaction.reply(`⏭️ Пропущено: **${current?.title ?? 'трек'}**`);
    } catch (e) {
        console.error('[music] Skip error:', e);
        return interaction.reply({ content: '❌ Ошибка при пропуске трека.', ephemeral: true });
    }
}

export async function handleStop(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
        return interaction.reply({ content: '❌ Вы должны быть в голосовом канале!', ephemeral: true });
    }

    const queue = useQueue(interaction.guildId!);

    if (!queue) {
        return interaction.reply({ content: '❌ Нет активной очереди.', ephemeral: true });
    }

    try {
        queue.delete();
        return interaction.reply('⏹️ Воспроизведение остановлено, очередь очищена.');
    } catch (e) {
        console.error('[music] Stop error:', e);
        return interaction.reply({ content: '❌ Ошибка при остановке.', ephemeral: true });
    }
}

export async function handleQueue(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);

    if (!queue || queue.isEmpty()) {
        return interaction.reply({ content: '📭 Очередь пуста.', ephemeral: true });
    }

    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray().slice(0, 10);

    const embed = new EmbedBuilder()
        .setTitle('🎵 Текущая очередь')
        .setColor(0x8B5CF6);

    if (current) {
        embed.addFields({
            name: '▶️ Сейчас играет',
            value: `**[${current.title}](${current.url})** — ${current.duration}`,
        });
    }

    if (tracks.length > 0) {
        const list = tracks.map((t, i) => `\`${i + 1}.\` **${t.title}** — ${t.duration}`).join('\n');
        embed.addFields({ name: 'Далее в очереди', value: list });
    }

    const totalSize = queue.tracks.size;
    if (totalSize > 10) {
        embed.setFooter({ text: `...и ещё ${totalSize - 10} треков` });
    }

    return interaction.reply({ embeds: [embed] });
}
