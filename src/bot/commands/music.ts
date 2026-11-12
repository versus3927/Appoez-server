import { EmbedBuilder, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import { enqueueMusic, getMusicQueue, skipMusic, stopMusic } from '../music-manager';

export async function handlePlay(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  const query = interaction.options.getString('query', true);

  if (!member.voice.channelId) {
    return interaction.reply({ content: '❌ Зайди в голосовой канал сначала!', ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const track = await enqueueMusic(interaction, member, query);

    const embed = new EmbedBuilder()
      .setTitle('🎶 Добавлено в очередь')
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: '👤 Автор', value: track.author || 'Неизвестен', inline: true },
        { name: '⏱️ Длительность', value: track.duration || '?', inline: true },
      )
      .setThumbnail(track.thumbnail)
      .setColor(0x8b5cf6)
      .setFooter({ text: `Запросил: ${track.requestedBy}` });

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[music] Play failed:', message);
    return interaction.editReply(`❌ Не удалось воспроизвести: ${message}`);
  }
}

export async function handleSkip(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channelId) {
    return interaction.reply({ content: '❌ Зайди в голосовой канал!', ephemeral: true });
  }

  const current = skipMusic(interaction.guildId!);
  if (!current) {
    return interaction.reply({ content: '❌ Сейчас ничего не играет.', ephemeral: true });
  }

  return interaction.reply(`⏭️ Пропущено: **${current.title}**`);
}

export async function handleStop(interaction: ChatInputCommandInteraction) {
  const stopped = stopMusic(interaction.guildId!);
  if (!stopped) {
    return interaction.reply({ content: '❌ Нет активной очереди.', ephemeral: true });
  }

  return interaction.reply('⏹️ Воспроизведение остановлено, очередь очищена.');
}

export async function handleQueue(interaction: ChatInputCommandInteraction) {
  const state = getMusicQueue(interaction.guildId!);
  if (!state || (!state.current && state.queue.length === 0)) {
    return interaction.reply({ content: '📭 Очередь пуста.', ephemeral: true });
  }

  const embed = new EmbedBuilder().setTitle('🎵 Текущая очередь').setColor(0x8b5cf6);

  if (state.current) {
    embed.addFields({
      name: '▶️ Сейчас играет',
      value: `**[${state.current.title}](${state.current.url})** — ${state.current.duration}`,
    });
  }

  if (state.queue.length > 0) {
    embed.addFields({
      name: 'Далее',
      value: state.queue
        .slice(0, 10)
        .map((track, index) => `\`${index + 1}.\` **${track.title}** — ${track.duration}`)
        .join('\n'),
    });
  }

  if (state.queue.length > 10) {
    embed.setFooter({ text: `...и ещё ${state.queue.length - 10} треков` });
  }

  return interaction.reply({ embeds: [embed] });
}
