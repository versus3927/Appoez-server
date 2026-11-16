import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type Message, PermissionFlagsBits } from 'discord.js';
import { eq, desc } from 'drizzle-orm';
import { QUESTIONS } from './quiz-questions';

async function getDbSafe() {
  const { getDb } = await import('@/db');
  const { userStats } = await import('@/db/schema');
  const database = getDb();
  if (!database) throw new Error('БД не подключена.');
  return { db: database, userStats };
}

async function ensureUser(userId: string, guildId: string) {
  const { db, userStats } = await getDbSafe();
  let stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
  if (!stats) {
    await db.insert(userStats).values({ userId, guildId, coins: 100 }).onConflictDoNothing();
    stats = await db.query.userStats.findFirst({ where: eq(userStats.userId, userId) });
  }
  return stats!;
}

export async function handleBalance(interaction: ChatInputCommandInteraction) {
  try {
    const target = interaction.options.getUser('user') || interaction.user;
    const stats = await ensureUser(target.id, interaction.guildId!);
    const embed = new EmbedBuilder()
      .setTitle(`💰 Баланс ${target.username}`)
      .setDescription(`**${stats.coins}** монет`)
      .setColor(0xf1c40f);
    return interaction.editReply({ embeds: [embed] });
  } catch (e) {
    return interaction.editReply({ content: `❌ ${e instanceof Error ? e.message : e}` });
  }
}

export async function handleTopCoins(interaction: ChatInputCommandInteraction) {
  try {
    const { db, userStats } = await getDbSafe();
    const top = await db.query.userStats.findMany({ orderBy: [desc(userStats.coins)], limit: 10 });
    let descText = '';
    for (let i = 0; i < top.length; i++) {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
      descText += `${medal} <@${top[i].userId}> — ${top[i].coins} 💰\n`;
    }
    const embed = new EmbedBuilder()
      .setTitle('🏆 Топ богачей')
      .setDescription(descText || 'Пока никого нет.')
      .setColor(0xf1c40f);
    return interaction.editReply({ embeds: [embed] });
  } catch (e) {
    return interaction.editReply({ content: `❌ ${e instanceof Error ? e.message : e}` });
  }
}

export async function handleHunt(interaction: ChatInputCommandInteraction) {
  try {
    const { db, userStats } = await getDbSafe();
    const stats = await ensureUser(interaction.user.id, interaction.guildId!);
    const now = new Date();

    let dailyBonus = 0;
    if (stats.coins < 100) {
      const last = stats.lastHunt;
      const hoursSinceLast = last ? (now.getTime() - last.getTime()) / (1000 * 60 * 60) : 999;
      if (hoursSinceLast >= 24) dailyBonus = 500;
    }

    if (stats.lastHunt) {
      const diffHours = (now.getTime() - stats.lastHunt.getTime()) / (1000 * 60 * 60);
      if (diffHours < 1 && dailyBonus === 0) {
        const waitMins = Math.ceil((1 - diffHours) * 60);
        return interaction.editReply({ content: `⏱️ Охотиться можно раз в час! Подожди ещё **${waitMins}** мин.` });
      }
    }

    const reward = Math.floor(Math.random() * 41) + 10;
    const total = reward + dailyBonus;
    await db.update(userStats).set({ coins: stats.coins + total, lastHunt: now }).where(eq(userStats.userId, interaction.user.id));

    let desc = `Ты добыл **${reward} 💰** на охоте!`;
    if (dailyBonus > 0) desc += `\n🎁 Ежедневный бонус: **+${dailyBonus} 💰** (баланс был < 100)`;
    const embed = new EmbedBuilder().setTitle('🏹 Охота').setDescription(desc).setColor(0x2ecc71);
    return interaction.editReply({ embeds: [embed] });
  } catch (e) {
    return interaction.editReply({ content: `❌ ${e instanceof Error ? e.message : e}` });
  }
}

export async function handleRoulette(interaction: ChatInputCommandInteraction) {
  try {
    const { db, userStats } = await getDbSafe();
    const amount = interaction.options.getInteger('amount', true);
    const bet = interaction.options.getString('bet', true);
    if (amount <= 0) return interaction.editReply({ content: '❌ Ставка должна быть больше 0.' });
    
    const stats = await ensureUser(interaction.user.id, interaction.guildId!);
    if (stats.coins < amount) return interaction.editReply({ content: `❌ Недостаточно монет. У тебя **${stats.coins} 💰**.` });

    const roll = Math.floor(Math.random() * 37);
    let resultColor = 'green';
    if (roll !== 0) resultColor = roll % 2 === 0 ? 'black' : 'red';
    let win = bet === resultColor;
    const multiplier = bet === 'green' ? 36 : 2;
    const profit = win ? (amount * multiplier) - amount : -amount;
    await db.update(userStats).set({ coins: stats.coins + profit }).where(eq(userStats.userId, interaction.user.id));

    const emoji = resultColor === 'red' ? '🔴' : resultColor === 'black' ? '⚫' : '🟢';
    const embed = new EmbedBuilder()
      .setTitle('🎰 Рулетка')
      .setDescription(`Выпало: **${roll}** ${emoji}\n\n${win ? `🎉 Ты выиграл **${amount * multiplier} 💰**!` : `💀 Ты проиграл **${amount} 💰**.`}\nБаланс: **${stats.coins + profit} 💰**`)
      .setColor(win ? 0x2ecc71 : 0xe74c3c);
    return interaction.editReply({ embeds: [embed] });
  } catch (e) {
    return interaction.editReply({ content: `❌ ${e instanceof Error ? e.message : e}` });
  }
}

export async function handleDuel(interaction: ChatInputCommandInteraction) {
  try {
    const target = interaction.options.getUser('user', true);
    if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ Нельзя вызвать себя.' });
    if (target.bot) return interaction.editReply({ content: '❌ Нельзя драться с ботом.' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('duel_accept').setLabel('Принять').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('duel_decline').setLabel('Отказаться').setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({ content: `⚔️ <@${target.id}>, тебя вызывает на дуэль <@${interaction.user.id}>!`, components: [row] });
    const response = await interaction.fetchReply();
    
    const confirmation = await response.awaitMessageComponent({ filter: (i: any) => i.user.id === target.id, time: 60_000 }).catch(() => null);
    if (!confirmation) return interaction.editReply({ content: '❌ Время вышло. Дуэль отменена.', components: [] });
    if (confirmation.customId === 'duel_decline') {
      await confirmation.update({ content: '❌ Дуэль отменена.', components: [] });
      return;
    }

    let hp1 = 3, hp2 = 3, round = 0;
    const actRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('act_attack').setLabel('🗡️ Удар').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('act_block').setLabel('🛡️ Блок').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('act_dodge').setLabel('💨 Уклон').setStyle(ButtonStyle.Success),
    );
    await confirmation.update({ content: `⚔️ **Дуэль!** <@${interaction.user.id}> vs <@${target.id}>\nHP: [${hp1}] vs [${hp2}]\nВыберите действие!`, components: [actRow] });

    while (hp1 > 0 && hp2 > 0) {
      round++;
      let p1: string | null = null, p2: string | null = null;
      const collector = response.createMessageComponentCollector({ time: 30_000 });
      await new Promise<void>(resolve => {
        collector.on('collect', async (i: any) => {
          if (i.user.id === interaction.user.id && !p1) { p1 = i.customId; await i.reply({ content: '✅', ephemeral: true }); }
          else if (i.user.id === target.id && !p2) { p2 = i.customId; await i.reply({ content: '✅', ephemeral: true }); }
          else await i.reply({ content: '⏳', ephemeral: true });
          if (p1 && p2) collector.stop();
        });
        collector.on('end', () => resolve());
      });
      if (!p1 || !p2) { await interaction.editReply({ content: '⏱️ Время вышло! Ничья.', components: [] }); return; }
      let d1 = 0, d2 = 0;
      if (p1 !== p2) {
        if ((p1 === 'act_attack' && p2 === 'act_dodge') || (p1 === 'act_dodge' && p2 === 'act_block') || (p1 === 'act_block' && p2 === 'act_attack')) d2 = 1;
        else d1 = 1;
      }
      hp1 -= d1; hp2 -= d2;
      if (hp1 <= 0 || hp2 <= 0) break;
      await interaction.editReply({ content: `⚔️ **Раунд ${round}!** <@${interaction.user.id}> [${hp1} HP] vs <@${target.id}> [${hp2} HP]\nВыберите действие!`, components: [actRow] });
    }
    const winnerId = hp1 > 0 ? interaction.user.id : hp2 > 0 ? target.id : null;
    if (winnerId) {
      try {
        const { db, userStats } = await getDbSafe();
        const ws = await ensureUser(winnerId, interaction.guildId!);
        await db.update(userStats).set({ coins: ws.coins + 50 }).where(eq(userStats.userId, winnerId));
      } catch {}
      await interaction.editReply({ content: `🏆 <@${winnerId}> побеждает и получает **50 💰**!`, components: [] });
    } else await interaction.editReply({ content: '🤝 Ничья!', components: [] });
  } catch { await interaction.editReply({ content: '❌ Произошла ошибка.', components: [] }).catch(() => {}); }
}

const WORDS = ["ПРОГРАММИСТ", "СЕРВЕР", "ДИСКОРД", "РУЛЕТКА", "ЭКОНОМИКА", "МОНЕТА", "АДМИН", "МУЗЫКА", "КОМПЬЮТЕР", "ИНТЕРНЕТ", "ПЛАНЕТА", "КОСМОС", "РОБОТ", "МАТРИЦА", "ГАЛАКТИКА"];

export async function handleHangman(interaction: ChatInputCommandInteraction) {
  try {
    const mode = interaction.options.getString('mode') ?? 'solo';
    const bet = interaction.options.getInteger('bet', true);
    if (bet < 0) return interaction.editReply({ content: '❌ Ставка не может быть отрицательной.' });

    const stats = await ensureUser(interaction.user.id, interaction.guildId!);
    if (stats.coins < bet) return interaction.editReply({ content: `❌ У тебя недостаточно монет (нужно **${bet} 💰**, а у тебя **${stats.coins}**).` });

    if (mode === 'solo') await hangmanSolo(interaction, bet);
    else await hangmanDuo(interaction, bet);
  } catch (e) {
    return interaction.editReply({ content: `❌ ${e instanceof Error ? e.message : e}` });
  }
}

async function hangmanSolo(interaction: ChatInputCommandInteraction, bet: number) {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const guessed = new Set<string>();
  let mistakes = 0;
  const maxMistakes = 6;
  const playerId = interaction.user.id;

  const getDisplay = () => word.split('').map(l => guessed.has(l) ? `**${l}**` : '⬜').join(' ');
  const isWon = () => word.split('').every(l => guessed.has(l));

  await interaction.editReply(`🎮 **Виселица** (соло)\nСтавка: **${bet} 💰**\nСлово: ${getDisplay()}\nОшибок: ${mistakes}/${maxMistakes}\n*Пишите одну русскую букву! (1 мин на ход)*`);

  const channel = interaction.channel as any;
  let lastActivity = Date.now();
  const collector = channel.createMessageCollector({ time: 600_000 });

  const timeout = setInterval(() => { if (Date.now() - lastActivity > 60_000) collector.stop('timeout'); }, 5000);

  collector.on('collect', async (m: Message) => {
    if (m.author.bot || m.author.id !== playerId) return;
    const letter = m.content.toUpperCase().trim();
    if (letter.length !== 1 || !/[А-ЯЁ]/.test(letter)) return;
    lastActivity = Date.now();
    if (guessed.has(letter)) { const r = await m.reply('Было!'); setTimeout(() => r.delete().catch(() => {}), 3000); return; }
    guessed.add(letter);
    if (!word.includes(letter)) mistakes++;
    if (mistakes >= maxMistakes) collector.stop('lost');
    else if (isWon()) collector.stop('won');
    else await interaction.editReply(`🎮 **Виселица** (соло)\nСтавка: **${bet} 💰**\nСлово: ${getDisplay()}\nОшибок: ${mistakes}/${maxMistakes}`);
  });

  collector.on('end', async (_: any, reason: string) => {
    clearInterval(timeout);
    const { db, userStats } = await getDbSafe();
    const s = await ensureUser(playerId, interaction.guildId!);
    if (reason === 'won') {
      await db.update(userStats).set({ coins: s.coins + bet }).where(eq(userStats.userId, playerId));
      await interaction.editReply(`🎉 **Победа!** <@${playerId}> угадал слово **${word}** и выиграл **${bet} 💰**!`);
    } else {
      await db.update(userStats).set({ coins: s.coins - bet }).where(eq(userStats.userId, playerId));
      const msg = reason === 'lost' ? 'Проигрыш!' : 'Время вышло!';
      await interaction.editReply(`💀 **${msg}** <@${playerId}>, слово: **${word}**. Ты потерял **${bet} 💰**.`);
    }
  });
}

async function hangmanDuo(interaction: ChatInputCommandInteraction, bet: number) {
  const p1 = interaction.user;
  const target = interaction.options.getUser('opponent');
  if (!target || target.bot || target.id === p1.id) return interaction.editReply({ content: '❌ Укажи соперника.' });

  const tStats = await ensureUser(target.id, interaction.guildId!);
  if (tStats.coins < bet) return interaction.editReply({ content: `❌ У противника недостаточно монет для этой ставки (**${bet} 💰**).` });

  const acceptRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('hm_accept').setLabel('Принять').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('hm_decline').setLabel('Отказаться').setStyle(ButtonStyle.Danger),
  );
  
  await interaction.editReply({ content: `🎮 <@${target.id}>, <@${p1.id}> вызывает тебя на дуэль в виселицу! Ставка: **${bet} 💰**`, components: [acceptRow] });
  const resp = await interaction.fetchReply();

  const conf = await resp.awaitMessageComponent({ filter: (i: any) => i.user.id === target.id, time: 60_000 }).catch(() => null);
  if (!conf) return interaction.editReply({ content: '❌ Время вышло. Игра отменена.', components: [] });
  if (conf.customId === 'hm_decline') {
    await conf.update({ content: '❌ Игра отменена.', components: [] });
    return;
  }
  
  await conf.update({ content: '🎮 **Виселица (дуэль)** начинается!', components: [] });

  const word1 = WORDS[Math.floor(Math.random() * WORDS.length)], word2 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const g1 = new Set<string>(), g2 = new Set<string>();
  let m1 = 0, m2 = 0, turn = 0; // 0=p1, 1=target
  const players = [p1, target], words = [word1, word2], sets = [g1, g2], mists = [m1, m2];
  const maxM = 6;

  const status = () => `🎮 **Виселица (дуэль)** | Ставка: **${bet} 💰**\n\n<@${p1.id}>: ${word1.split('').map(l=>g1.has(l)?`**${l}**`:'⬜').join(' ')} (ошибок: ${mists[0]}/${maxM})\n<@${target.id}>: ${word2.split('').map(l=>g2.has(l)?`**${l}**`:'⬜').join(' ')} (ошибок: ${mists[1]}/${maxM})\n\nХодит: <@${players[turn].id}>! (1 мин)`;

  await interaction.editReply(status());
  const channel = interaction.channel as any;
  let lastAct = Date.now();
  const collector = channel.createMessageCollector({ time: 600_000 });
  const timeout = setInterval(() => { if (Date.now() - lastAct > 60_000) collector.stop('timeout'); }, 5000);

  collector.on('collect', async (m: Message) => {
    if (m.author.bot || m.author.id !== players[turn].id) return;
    const letter = m.content.toUpperCase().trim();
    if (letter.length !== 1 || !/[А-ЯЁ]/.test(letter)) return;
    lastAct = Date.now();
    if (sets[turn].has(letter)) { const r = await m.reply('Было!'); setTimeout(() => r.delete().catch(() => {}), 3000); return; }
    sets[turn].add(letter);
    if (!words[turn].includes(letter)) { mists[turn]++; turn = turn === 0 ? 1 : 0; }
    if (words[0].split('').every(l=>g1.has(l))) collector.stop('p1win');
    else if (words[1].split('').every(l=>g2.has(l))) collector.stop('p2win');
    else if (mists[0] >= maxM) collector.stop('p2win');
    else if (mists[1] >= maxM) collector.stop('p1win');
    else await interaction.editReply(status());
  });

  collector.on('end', async (_: any, reason: string) => {
    clearInterval(timeout);
    const { db, userStats } = await getDbSafe();
    const s1 = await ensureUser(p1.id, interaction.guildId!), s2 = await ensureUser(target.id, interaction.guildId!);
    if (reason === 'p1win') {
      await db.update(userStats).set({ coins: s1.coins + bet }).where(eq(userStats.userId, p1.id));
      await db.update(userStats).set({ coins: s2.coins - bet }).where(eq(userStats.userId, target.id));
      await interaction.editReply(`🏆 <@${p1.id}> победил и выиграл **${bet} 💰**! Слова: ${word1}/${word2}`);
    } else if (reason === 'p2win') {
      await db.update(userStats).set({ coins: s2.coins + bet }).where(eq(userStats.userId, target.id));
      await db.update(userStats).set({ coins: s1.coins - bet }).where(eq(userStats.userId, p1.id));
      await interaction.editReply(`🏆 <@${target.id}> победил и выиграл **${bet} 💰**! Слова: ${word1}/${word2}`);
    } else {
      await interaction.editReply(`⏰ Время вышло! Ничья, монеты на месте. Слова: ${word1}/${word2}`);
    }
  });
}

export async function handleQuiz(interaction: ChatInputCommandInteraction) {
  // Checking Admin explicitly for quiz
  const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
  const hasAdmin = member?.permissions.has(PermissionFlagsBits.Administrator) || member?.roles.cache.some(r => r.name.toLowerCase().includes('administrator'));
  if (!hasAdmin) {
    return interaction.editReply('❌ Эту команду могут использовать только администраторы.');
  }

  const qObj = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  const acceptable = [qObj.a.toLowerCase(), qObj.a.toLowerCase().replace('ё', 'е')];
  
  await interaction.editReply(`🧠 **Квиз!** Первый правильный ответ получит **20 💰**!\n\n**${qObj.q}**`);
  
  const channel = interaction.channel as any;
  const collector = channel.createMessageCollector({ time: 20_000 });
  let answered = false;
  
  collector.on('collect', async (m: Message) => {
    if (m.author.bot || answered) return;
    const answer = m.content.toLowerCase().trim().replace('ё', 'е');
    if (acceptable.includes(answer)) {
      answered = true; collector.stop('correct');
      try {
        const { db, userStats } = await getDbSafe();
        const s = await ensureUser(m.author.id, interaction.guildId!);
        await db.update(userStats).set({ coins: s.coins + 20 }).where(eq(userStats.userId, m.author.id));
      } catch {}
      await interaction.followUp(`🎉 <@${m.author.id}> правильно: **${qObj.a}**! +**20 💰**`);
    }
  });
  
  collector.on('end', (_: any, reason: string) => { 
    if (reason !== 'correct') interaction.followUp(`⏰ Ответ: **${qObj.a}**`).catch(() => {}); 
  });
}
