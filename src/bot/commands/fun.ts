import { EmbedBuilder, type ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export async function handleRoll(interaction: ChatInputCommandInteraction) {
  const roll = Math.floor(Math.random() * 100) + 1;
  await interaction.reply({ content: `🎲 Ты бросил кубик и выпало: **${roll}**` });
}

export async function handle8Ball(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const question = interaction.options.getString('question', true);
  
  try {
    const res = await fetch(`https://hercai.onrender.com/v3/hercai?question=${encodeURIComponent(question)}`);
    const data = await res.json();
    const reply = data.reply || 'Я сейчас не могу ответить, попробуй позже.';
    
    const embed = new EmbedBuilder()
      .setTitle('🤖 ИИ Ассистент')
      .addFields(
        { name: 'Вопрос', value: question },
        { name: 'Ответ', value: reply },
      )
      .setColor(0x9b59b6);
      
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[ai] API Error:', error);
    await interaction.editReply('❌ ИИ сейчас недоступен. Попробуй позже.');
  }
}

export async function handleAvatar(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const embed = new EmbedBuilder()
    .setTitle(`🖼️ Аватар пользователя ${user.username}`)
    .setImage(user.displayAvatarURL({ size: 1024 }))
    .setColor(0x3498db);
  await interaction.reply({ embeds: [embed] });
}

export async function handleAnonymousSlash(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  const message = interaction.options.getString('message', true);

  const channel = interaction.guild?.channels.cache.find(
    (item) => item.type === 0 && item.name === '💗・анонимки',
  );

  if (!channel || !('send' in channel)) {
    return interaction.reply({ content: '❌ Канал анонимок не найден. Запусти /сетап заново.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('Новое послание!')
    .addFields(
      { name: 'От кого:', value: '| Анонимное сообщение' },
      { name: 'Кому:', value: `| <@${target.id}>` },
      { name: 'Сообщение:', value: `| ${message}` },
    )
    .setColor(0x1a1a1a);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('anon_open')
      .setLabel('Написать сообщение')
      .setEmoji('💗')
      .setStyle(ButtonStyle.Secondary),
  );

  await (channel as any).send({ content: `<@${target.id}>`, embeds: [embed], components: [row] });
  return interaction.reply({ content: '✅ Анонимка отправлена.', ephemeral: true });
}

export async function postAnonymousMessage(guild: ChatInputCommandInteraction['guild'], targetLabel: string, message: string) {
  const channel = guild?.channels.cache.find(
    (item) => item.type === 0 && item.name === '💗・анонимки',
  );
  if (!channel || !('send' in channel)) {
    throw new Error('Канал анонимок не найден');
  }

  const embed = new EmbedBuilder()
    .setTitle('Новое послание!')
    .addFields(
      { name: 'От кого:', value: '| Анонимное сообщение' },
      { name: 'Кому:', value: `| ${targetLabel}` },
      { name: 'Сообщение:', value: `| ${message}` },
    )
    .setColor(0x1a1a1a);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('anon_open')
      .setLabel('Написать сообщение')
      .setEmoji('💗')
      .setStyle(ButtonStyle.Secondary),
  );

  // Send the mention outside the embed so it actually pings the user
  await (channel as any).send({ content: targetLabel, embeds: [embed], components: [row] });
}
