import { ChatInputCommandInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { GuildQueue, useQueue } from 'discord-player';
import { player } from '../client';

export async function handlePlay(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString('query', true);
    const member = interaction.member as GuildMember;

    if (!member.voice.channel) {
        return interaction.reply({ content: '❌ Зайди в голосовой канал сначала!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const result = await player.play(member.voice.channel, query, {
            nodeOptions: {
                metadata: interaction,
                selfDeaf: true,
                volume: 80,
                leaveOnEmpty: true,
                leaveOnEmptyCooldown: 30_000,
                leaveOnEnd: false, // Don't leave immediately — keep queue alive
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
    if (!member.voice.channel) return interaction.reply({ content: '❌ Зайди в голосовой канал!', ephemeral: true });

    const queue = useQueue(interaction.guildId!);
    if (!queue?.isPlaying()) return interaction.reply({ content: '❌ Сейчас ничего не играет.', ephemeral: true });

    const current = queue.currentTrack;
    queue.node.skip();
    return interaction.reply(`⏭️ Пропущено: **${current?.title ?? 'трек'}**`);
}

export async function handleStop(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);
    if (!queue) return interaction.reply({ content: '❌ Нет активной очереди.', ephemeral: true });
    queue.delete();
    return interaction.reply('⏹️ Остановлено и очередь очищена.');
}

export async function handleQueue(interaction: ChatInputCommandInteraction) {
    const queue: GuildQueue | null = useQueue(interaction.guildId!);
    if (!queue || (queue.isEmpty() && !queue.currentTrack)) {
        return interaction.reply({ content: '📭 Очередь пуста.', ephemeral: true });
    }

    const current = queue.currentTrack;
    const tracks = queue.tracks.toArray().slice(0, 10);

    const embed = new EmbedBuilder().setTitle('🎵 Текущая очередь').setColor(0x8B5CF6);

    if (current) {
        embed.addFields({ name: '▶️ Сейчас играет', value: `**[${current.title}](${current.url})** — ${current.duration}` });
    }

    if (tracks.length > 0) {
        embed.addFields({ name: 'Далее', value: tracks.map((t, i) => `\`${i + 1}.\` **${t.title}** — ${t.duration}`).join('\n') });
    }

    if (queue.tracks.size > 10) embed.setFooter({ text: `...и ещё ${queue.tracks.size - 10} треков` });
    return interaction.reply({ embeds: [embed] });
}
