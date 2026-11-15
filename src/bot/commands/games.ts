import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, GuildMember, Message } from 'discord.js';
import { db } from '@/db';
import { userStats } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

// --- ECONOMY ---

async function getUserStats(userId: string, guildId: string) {
  let stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
  if (!stats) {
    await db.insert(userStats).values({ userId, guildId }).onConflictDoNothing();
    stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
  }
  return stats!;
}

export async function handleBalance(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const stats = await getUserStats(target.id, interaction.guildId!);
  
  const embed = new EmbedBuilder()
    .setTitle(`Баланс ${target.username}`)
    .setDescription(`💰 **${stats.coins}** монет`)
    .setColor(0xf1c40f);
    
  return interaction.reply({ embeds: [embed] });
}

export async function handleTopCoins(interaction: ChatInputCommandInteraction) {
  const top = await db.query.userStats.findMany({
    orderBy: [desc(userStats.coins)],
    limit: 10,
  });
  
  const embed = new EmbedBuilder()
    .setTitle('🏆 Топ богачей')
    .setColor(0xf1c40f);
    
  let descText = '';
  for (let i = 0; i < top.length; i++) {
    descText += `**${i + 1}.** <@${top[i].userId}> — ${top[i].coins} 💰\n`;
  }
  
  embed.setDescription(descText || 'Пока никого нет.');
  return interaction.reply({ embeds: [embed] });
}

export async function handleHunt(interaction: ChatInputCommandInteraction) {
  const stats = await getUserStats(interaction.user.id, interaction.guildId!);
  const now = new Date();
  
  if (stats.lastHunt) {
    const diffHours = (now.getTime() - stats.lastHunt.getTime()) / (1000 * 60 * 60);
    if (diffHours < 1) {
      const waitMins = Math.ceil((1 - diffHours) * 60);
      return interaction.reply({ content: `⏱️ Охотиться можно раз в час! Подожди еще ${waitMins} мин.`, ephemeral: true });
    }
  }
  
  const reward = Math.floor(Math.random() * 41) + 10; // 10 to 50
  
  await db.update(userStats)
    .set({ coins: stats.coins + reward, lastHunt: now })
    .where(eq(userStats.userId, interaction.user.id));
    
  const embed = new EmbedBuilder()
    .setTitle('🏹 Охота')
    .setDescription(`Ты сходил на охоту и добыл **${reward} 💰**!`)
    .setColor(0x2ecc71);
    
  return interaction.reply({ embeds: [embed] });
}

export async function handleRoulette(interaction: ChatInputCommandInteraction) {
  const amount = interaction.options.getInteger('amount', true);
  const bet = interaction.options.getString('bet', true);
  
  if (amount <= 0) return interaction.reply({ content: '❌ Ставка должна быть больше 0.', ephemeral: true });
  
  const stats = await getUserStats(interaction.user.id, interaction.guildId!);
  if (stats.coins < amount) {
    return interaction.reply({ content: `❌ Недостаточно монет. У тебя всего **${stats.coins} 💰**.`, ephemeral: true });
  }
  
  const roll = Math.floor(Math.random() * 37); // 0-36
  let resultColor = 'green';
  if (roll !== 0) {
    resultColor = roll % 2 === 0 ? 'black' : 'red';
  }
  
  let win = false;
  let multiplier = 0;
  
  if (bet === resultColor) {
    win = true;
    multiplier = bet === 'green' ? 36 : 2;
  }
  
  const profit = win ? (amount * multiplier) - amount : -amount;
  
  await db.update(userStats)
    .set({ coins: stats.coins + profit })
    .where(eq(userStats.userId, interaction.user.id));
    
  const emoji = resultColor === 'red' ? '🔴' : resultColor === 'black' ? '⚫' : '🟢';
  const embed = new EmbedBuilder()
    .setTitle('🎰 Рулетка')
    .setDescription(`Выпало: **${roll} ${emoji}**\n\n${win ? `🎉 Ты выиграл **${amount * multiplier} 💰**!` : `💀 Ты проиграл **${amount} 💰**.`}`)
    .setColor(win ? 0x2ecc71 : 0xe74c3c);
    
  return interaction.reply({ embeds: [embed] });
}

// --- GAMES ---

export async function handleDuel(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('user', true);
  
  if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Нельзя вызвать на дуэль самого себя.', ephemeral: true });
  if (target.bot) return interaction.reply({ content: '❌ Нельзя драться с ботом.', ephemeral: true });
  
  const acceptBtn = new ButtonBuilder().setCustomId('duel_accept').setLabel('Принять вызов').setStyle(ButtonStyle.Success);
  const declineBtn = new ButtonBuilder().setCustomId('duel_decline').setLabel('Отказаться').setStyle(ButtonStyle.Danger);
  
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, declineBtn);
  
  const response = await interaction.reply({
    content: `⚔️ <@${target.id}>, вас вызывает на дуэль <@${interaction.user.id}>!`,
    components: [row],
  });
  
  try {
    const confirmation = await response.awaitMessageComponent({
      filter: i => i.user.id === target.id,
      time: 60_000,
    });
    
    if (confirmation.customId === 'duel_decline') {
      return confirmation.update({ content: `❌ <@${target.id}> отказался от дуэли.`, components: [] });
    }
    
    // Duel starts
    let hp1 = 3;
    let hp2 = 3;
    
    const actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('act_attack').setLabel('🗡️ Удар').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('act_block').setLabel('🛡️ Блок').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('act_dodge').setLabel('💨 Уклонение').setStyle(ButtonStyle.Success),
    );
    
    await confirmation.update({
      content: `🔥 **Дуэль началась!** <@${interaction.user.id}> vs <@${target.id}>\nУ обоих по 3 HP. Выберите действие:`,
      components: [actRow]
    });
    
    let round = 1;
    while (hp1 > 0 && hp2 > 0) {
      const collector = response.createMessageComponentCollector({ time: 30_000 });
      let p1Choice: string | null = null;
      let p2Choice: string | null = null;
      
      await new Promise<void>((resolve) => {
        collector.on('collect', async i => {
          if (i.user.id === interaction.user.id && !p1Choice) {
            p1Choice = i.customId;
            await i.reply({ content: 'Действие выбрано!', ephemeral: true });
          } else if (i.user.id === target.id && !p2Choice) {
            p2Choice = i.customId;
            await i.reply({ content: 'Действие выбрано!', ephemeral: true });
          } else {
            await i.reply({ content: 'Вы уже сделали ход или не участвуете!', ephemeral: true });
          }
          if (p1Choice && p2Choice) {
            collector.stop();
          }
        });
        collector.on('end', () => resolve());
      });
      
      if (!p1Choice || !p2Choice) {
        await interaction.editReply({ content: '⏱️ Время вышло! Ничья.', components: [] });
        return;
      }
      
      // Logic: Attack beats Dodge, Dodge beats Block, Block beats Attack
      let p1Dmg = 0;
      let p2Dmg = 0;
      
      if (p1Choice === p2Choice) {
        // Tie
      } else if (p1Choice === 'act_attack' && p2Choice === 'act_dodge') p2Dmg = 1;
      else if (p1Choice === 'act_dodge' && p2Choice === 'act_block') p2Dmg = 1;
      else if (p1Choice === 'act_block' && p2Choice === 'act_attack') p2Dmg = 1;
      else p1Dmg = 1;
      
      hp1 -= p1Dmg;
      hp2 -= p2Dmg;
      
      const p1Emoji = p1Choice === 'act_attack' ? '🗡️' : p1Choice === 'act_block' ? '🛡️' : '💨';
      const p2Emoji = p2Choice === 'act_attack' ? '🗡️' : p2Choice === 'act_block' ? '🛡️' : '💨';
      
      if (hp1 <= 0 || hp2 <= 0) break;
      
      round++;
      await interaction.editReply({
        content: `⚔️ **Раунд ${round - 1} завершён!**\n<@${interaction.user.id}> ${p1Emoji} vs ${p2Emoji} <@${target.id}>\n\n❤️ HP: <@${interaction.user.id}> [${hp1}] | <@${target.id}> [${hp2}]\nВыбирайте следующий ход:`,
        components: [actRow]
      });
    }
    
    // Determine winner
    let winner = null;
    if (hp1 > 0 && hp2 <= 0) winner = interaction.user;
    else if (hp2 > 0 && hp1 <= 0) winner = target;
    
    if (winner) {
      // Award 50 coins
      const wStats = await getUserStats(winner.id, interaction.guildId!);
      await db.update(userStats).set({ coins: wStats.coins + 50 }).where(eq(userStats.userId, winner.id));
      
      await interaction.editReply({
        content: `🏆 **Победа!** <@${winner.id}> побеждает и получает **50 💰**!\nИтог: <@${interaction.user.id}> [${hp1} HP] | <@${target.id}> [${hp2} HP]`,
        components: []
      });
    } else {
      await interaction.editReply({
        content: `🤝 **Ничья!** Оба погибли.`,
        components: []
      });
    }
    
  } catch (e) {
    await interaction.editReply({ content: '⏱️ Время вышло! Вызов отменён.', components: [] });
  }
}

const WORDS = ["ПРОГРАММИСТ", "СЕРВЕР", "ДИСКОРД", "РУЛЕТКА", "ЭКОНОМИКА", "БАЗА", "МОНЕТА", "АДМИН", "МУЗЫКА"];

export async function handleHangman(interaction: ChatInputCommandInteraction) {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  let guessed = new Set<string>();
  let mistakes = 0;
  const maxMistakes = 6;
  
  const getDisplay = () => word.split('').map(l => guessed.has(l) ? l : '⬜').join(' ');
  
  await interaction.reply({
    content: `🎮 **Виселица**\nСлово: ${getDisplay()}\nОшибок: ${mistakes}/${maxMistakes}\n*Пишите по одной русской букве в чат!*`
  });
  
  const channel = interaction.channel as any;
  const collector = channel?.createMessageCollector({ time: 60_000 });
  if (!collector) return;
  
  collector.on('collect', async (m: Message) => {
    if (m.author.bot) return;
    const letter = m.content.toUpperCase().trim();
    if (letter.length !== 1 || !/[А-ЯЁ]/.test(letter)) return;
    
    if (guessed.has(letter)) {
      await m.reply('Эта буква уже была!').then(msg => setTimeout(() => msg.delete().catch(()=>{}), 3000));
      return;
    }
    
    guessed.add(letter);
    if (!word.includes(letter)) {
      mistakes++;
    }
    
    if (mistakes >= maxMistakes) {
      collector.stop();
      await interaction.editReply(`💀 **Вы проиграли!**\nЗагаданное слово было: **${word}**`);
    } else if (word.split('').every(l => guessed.has(l))) {
      collector.stop();
      const stats = await getUserStats(m.author.id, interaction.guildId!);
      await db.update(userStats).set({ coins: stats.coins + 30 }).where(eq(userStats.userId, m.author.id));
      await interaction.editReply(`🎉 **Победа!** <@${m.author.id}> угадал слово **${word}** и получил **30 💰**!`);
    } else {
      await interaction.editReply(`🎮 **Виселица**\nСлово: ${getDisplay()}\nОшибок: ${mistakes}/${maxMistakes}`);
    }
  });
}

const QUESTIONS = [
  { q: "Сколько бит в байте?", a: "8" },
  { q: "Какой цвет получается при смешивании синего и желтого?", a: "зеленый" },
  { q: "Самая большая планета Солнечной системы?", a: "юпитер" },
  { q: "Столица Японии?", a: "токио" },
  { q: "Сколько дней в високосном году?", a: "366" },
];

export async function handleQuiz(interaction: ChatInputCommandInteraction) {
  const qObj = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  
  await interaction.reply({
    content: `🧠 **Квиз!** Первый, кто ответит правильно, получит **20 💰**!\n\n**Вопрос:** ${qObj.q}`
  });
  
  const channel = interaction.channel as any;
  const collector = channel?.createMessageCollector({ time: 20_000 });
  if (!collector) return;
  
  collector.on('collect', async (m: Message) => {
    if (m.author.bot) return;
    
    if (m.content.toLowerCase().trim() === qObj.a.toLowerCase()) {
      collector.stop();
      const stats = await getUserStats(m.author.id, interaction.guildId!);
      await db.update(userStats).set({ coins: stats.coins + 20 }).where(eq(userStats.userId, m.author.id));
      await interaction.followUp(`🎉 <@${m.author.id}> ответил правильно: **${qObj.a}**! Начислено **20 💰**.`);
    }
  });
  
  collector.on('end', (collected: any, reason: string) => {
    if (reason === 'time') {
      interaction.followUp(`⏰ Время вышло! Правильный ответ был: **${qObj.a}**.`);
    }
  });
}
