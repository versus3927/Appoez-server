import { EmbedBuilder, type ChatInputCommandInteraction, type GuildMember } from 'discord.js';
import { enqueueMusic, getMusicQueue, skipMusic, stopMusic } from '../music-manager';

export async function handlePlay(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channelId) return interaction.reply({ content: '❌ Зайди в голосовой канал!', ephemeral: true });
  await interaction.deferReply();
  try {
    const track = await enqueueMusic(interaction, member, interaction.options.getString('query', true));
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🎶 Добавлено').setDescription(`**[${track.title}](${track.url})**`).addFields({ name: '👤', value: track.author, inline: true }, { name: '⏱️', value: track.duration, inline: true }).setThumbnail(track.thumbnail).setColor(0x8b5cf6).setFooter({ text: `Запросил: ${track.requestedBy}` })] });
  } catch (e) { await interaction.editReply(`❌ ${e instanceof Error ? e.message : e}`); }
}

export async function handleSkip(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channelId) return interaction.reply({ content: '❌ Зайди в голосовой канал!', ephemeral: true });
  const c = skipMusic(interaction.guildId!, member.voice.channelId);
  if (!c) return interaction.reply({ content: '❌ Ничего не играет.', ephemeral: true });
  return interaction.reply(`⏭️ Пропущено: **${c.title}**`);
}

export async function handleStop(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channelId) return interaction.reply({ content: '❌ Зайди в голосовой канал!', ephemeral: true });
  if (!stopMusic(interaction.guildId!, member.voice.channelId)) return interaction.reply({ content: '❌ Нет очереди.', ephemeral: true });
  return interaction.reply('⏹️ Остановлено.');
}

export async function handleQueue(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channelId) return interaction.reply({ content: '❌ Зайди в голосовой канал!', ephemeral: true });
  const s = getMusicQueue(interaction.guildId!, member.voice.channelId);
  if (!s || (!s.current && s.queue.length === 0)) return interaction.reply({ content: '📭 Очередь пуста.', ephemeral: true });
  const embed = new EmbedBuilder().setTitle('🎵 Очередь').setColor(0x8b5cf6);
  if (s.current) embed.addFields({ name: '▶️ Сейчас', value: `**${s.current.title}** — ${s.current.duration}` });
  if (s.queue.length > 0) embed.addFields({ name: 'Далее', value: s.queue.slice(0, 10).map((t, i) => `\`${i+1}.\` **${t.title}** — ${t.duration}`).join('\n') });
  return interaction.reply({ embeds: [embed] });
}
