import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

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
        'Даже не думай.', 'Мой ответ — нет.', 'По моим данным — нет.', 'Перспективы не очень хорошие.', 'Весьма сомнительно.'
    ];
    
    const answer = answers[Math.floor(Math.random() * answers.length)];
    
    const embed = new EmbedBuilder()
        .setTitle('🎱 Магический Шар')
        .addFields(
            { name: 'Вопрос', value: question },
            { name: 'Ответ', value: answer }
        )
        .setColor(0x9B59B6);
        
    await interaction.reply({ embeds: [embed] });
}

export async function handleAvatar(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser('user') || interaction.user;
    
    const embed = new EmbedBuilder()
        .setTitle(`🖼️ Аватар пользователя ${user.username}`)
        .setImage(user.displayAvatarURL({ size: 1024 }))
        .setColor(0x3498DB);
        
    await interaction.reply({ embeds: [embed] });
}
