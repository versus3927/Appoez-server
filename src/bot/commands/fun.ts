import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';

export async function handleRoll(interaction: ChatInputCommandInteraction) {
  const roll = Math.floor(Math.random() * 100) + 1;
  await interaction.reply({ content: `🎲 Ты бросил кубик и выпало: **${roll}**` });
}

export async function handle8Ball(interaction: ChatInputCommandInteraction) {
  const question = interaction.options.getString('question', true);
  const answers = [
    'Бесспорно.', 'Предрешено.', 'Никаких сомнений.', 'Определённо да.', 'Можешь быть уверен в этом.',
    'Мне кажется — да.', 'Вероятнее всего.', 'Хорошие перспективы.', 'Знаки говорят — да.', 'Да.',
    'Пока неясно, попробуй снова.', 'Спроси позже.', 'Лучше не рассказывать.', 'Сейчас нельзя предсказать.', 'Сконцентрируйся и спроси опять.',
    'Даже не думай.', 'Мой ответ — нет.', 'По моим данным — нет.', 'Перспективы не очень хорошие.', 'Весьма сомнительно.',
  ];
  const answer = answers[Math.floor(Math.random() * answers.length)];
  const embed = new EmbedBuilder()
    .setTitle('🎱 Магический Шар')
    .addFields(
      { name: 'Вопрос', value: question },
      { name: 'Ответ', value: answer },
    )
    .setColor(0x9b59b6);
  await interaction.reply({ embeds: [embed] });
}

export async function handleAvatar(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const embed = new EmbedBuilder()
    .setTitle(`🖼️ Аватар пользователя ${user.username}`)
    .setImage(user.displayAvatarURL({ size: 1024 }))
    .setColor(0x3498db);
  await interaction.reply({ embeds: [embed] });
}

function buildAnonymousEmbed(targetLabel: string, message: string) {
  return new EmbedBuilder()
    .setTitle('💗 Новое анонимное послание!')
    .addFields(
      { name: 'От кого', value: 'Анонимное сообщение' },
      { name: 'Кому', value: targetLabel },
      { name: 'Сообщение', value: message },
    )
    .setColor(0xec4899)
    .setTimestamp();
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

  await (channel as any).send({ embeds: [buildAnonymousEmbed(`<@${target.id}>`, message)] });
  return interaction.reply({ content: '✅ Анонимка отправлена.', ephemeral: true });
}

export async function postAnonymousMessage(guild: ChatInputCommandInteraction['guild'], targetLabel: string, message: string) {
  const channel = guild?.channels.cache.find(
    (item) => item.type === 0 && item.name === '💗・анонимки',
  );
  if (!channel || !('send' in channel)) {
    throw new Error('Канал анонимок не найден');
  }
  await (channel as any).send({ embeds: [buildAnonymousEmbed(targetLabel, message)] });
}
