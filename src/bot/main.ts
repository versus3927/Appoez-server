import { Events } from 'discord.js';
import { ensureTables } from './ensure-tables';
import { client } from './client';
import { startMusicBotPool } from './music-bot-pool';
import { deployCommands } from './deploy-commands';
import { handleGuildMemberAdd } from './events/guildMemberAdd';
import { registerMessageLogs } from './events/messageLogs';
import { handleInteraction } from './events/interactionCreate';
import { handleMessageCreate } from './events/messageCreate';
import { handleVoiceStateUpdate } from './events/voiceStateUpdate';

let startPromise: Promise<boolean> | null = null;

export function startBot(): Promise<boolean> {
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      console.error('[bot] DISCORD_TOKEN is missing — bot stays offline.');
      startPromise = null;
      return false;
    }

    try {
      client.once(Events.ClientReady, (readyClient) => {
        console.log(`[bot] ✅ Logged in as ${readyClient.user.tag}`);
        void ensureTables().catch((e) => console.error('[db] ensureTables error:', e));
        void deployCommands().catch((error) =>
          console.error('[bot] Failed to deploy slash commands:', error),
        );
        registerMessageLogs();
        void startMusicBotPool().catch((error) =>
          console.error('[music-pool] Failed to start extra agents:', error),
        );
      });

      client.on(Events.InteractionCreate, (interaction) =>
        void handleInteraction(interaction).catch((error) =>
          console.error('[bot] interactionCreate error:', error),
        ),
      );

      client.on(Events.MessageCreate, (message) =>
        void handleMessageCreate(message).catch((error) =>
          console.error('[bot] messageCreate error:', error),
        ),
      );

      client.on(Events.VoiceStateUpdate, (oldState, newState) =>
        void handleVoiceStateUpdate(oldState, newState).catch((error) =>
          console.error('[bot] voiceStateUpdate error:', error),
        ),
      );

      client.on(Events.GuildMemberAdd, (member) =>
        void handleGuildMemberAdd(member).catch((error) =>
          console.error('[bot] guildMemberAdd error:', error),
        ),
      );

      await client.login(token);
      return true;
    } catch (error) {
      console.error('[bot] Failed to start:', error);
      startPromise = null;
      return false;
    }
  })();

  return startPromise;
}

export function isBotStartupTriggered(): boolean {
  return startPromise !== null;
}
