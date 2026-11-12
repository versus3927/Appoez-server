import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type ChatInputCommandInteraction } from 'discord.js';

export async function handleRoll(interaction: ChatInputCommandInteraction) {
  await interaction.reply(`🎲 Выпало: **${Math.floor(Math.random() * 100) + 1}**`);
}

export async function handle8Ball(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const question = interaction.options.getString('question', true);
  try {
    const res = await fetch(`https://hercai.onrender.com/v3/hercai?question=${encodeURIComponent(question)}`);
    const data = await res.json();
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🤖 ИИ').addFields({ name: 'Вопрос', value: question }, { name: 'Ответ', value: data.reply || 'Не могу ответить.' }).setColor(0x9b59b6)] });
  } catch { await interaction.editReply('❌ ИИ недоступен. Попробуй позже.'); }
}

export async function handleAvatar(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user') || interaction.user;
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🖼️ ${user.username}`).setImage(user.displayAvatarURL({ size: 1024 })).setColor(0x3498db)] });
}

export async function handleAnonymousSlash(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  const message = interaction.options.getString('message', true);

  const anonChannel = interaction.guild?.channels.cache.find(c => c.type === 0 && c.name === '💗・анонимки');
  if (!anonChannel || !('send' in anonChannel)) return interaction.reply({ content: '❌ Канал анонимок не найден.', ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle('Новое послание!')
    .addFields(
      { name: 'От кого:', value: '> Анонимное сообщение' },
      { name: 'Кому:', value: `> <@${target.id}>` },
      { name: 'Сообщение:', value: `> ${message}` },
    )
    .setColor(0x1a1a1a);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('anon_open').setLabel('Написать сообщение').setEmoji('💗').setStyle(ButtonStyle.Secondary),
  );

  await (anonChannel as any).send({ content: `<@${target.id}>`, embeds: [embed], components: [row] });

  // Send DM to target
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle('💗 Тебе пришла анонимка!')
      .setDescription(`> ${message}`)
      .setColor(0xec4899)
      .setFooter({ text: `Сервер: ${interaction.guild?.name ?? '?'}` })
      .setTimestamp();
    await target.send({ embeds: [dmEmbed] });
  } catch { /* DMs may be closed */ }

  return interaction.reply({ content: '✅ Анонимка отправлена и продублирована в ЛС.', ephemeral: true });
}

export async function postAnonymousMessage(guild: ChatInputCommandInteraction['guild'], targetLabel: string, message: string) {
  const anonChannel = guild?.channels.cache.find(c => c.type === 0 && c.name === '💗・анонимки');
  if (!anonChannel || !('send' in anonChannel)) throw new Error('Канал анонимок не найден');

  // Try to resolve user from targetLabel for DM
  let resolvedUserId: string | null = null;
  const mentionMatch = targetLabel.match(/^<@!?(\d+)>$/);
  if (mentionMatch) resolvedUserId = mentionMatch[1];
  else if (/^\d{17,20}$/.test(targetLabel)) resolvedUserId = targetLabel;

  const embed = new EmbedBuilder()
    .setTitle('Новое послание!')
    .addFields(
      { name: 'От кого:', value: '> Анонимное сообщение' },
      { name: 'Кому:', value: resolvedUserId ? `> <@${resolvedUserId}>` : `> ${targetLabel}` },
      { name: 'Сообщение:', value: `> ${message}` },
    )
    .setColor(0x1a1a1a);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('anon_open').setLabel('Написать сообщение').setEmoji('💗').setStyle(ButtonStyle.Secondary),
  );

  const mentionContent = resolvedUserId ? `<@${resolvedUserId}>` : targetLabel;
  await (anonChannel as any).send({ content: mentionContent, embeds: [embed], components: [row] });

  // Send DM
  if (resolvedUserId && guild) {
    try {
      const member = await guild.members.fetch(resolvedUserId);
      const dmEmbed = new EmbedBuilder()
        .setTitle('💗 Тебе пришла анонимка!')
        .setDescription(`> ${message}`)
        .setColor(0xec4899)
        .setFooter({ text: `Сервер: ${guild.name}` })
        .setTimestamp();
      await member.send({ embeds: [dmEmbed] });
    } catch { /* DMs closed */ }
  }
}
