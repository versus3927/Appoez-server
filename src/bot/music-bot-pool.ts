import { createRequire } from 'module';
import { Client, GatewayIntentBits, Partials, type Guild } from 'discord.js';

const req = createRequire(import.meta.url);

try {
  const installer = req('@ffmpeg-installer/ffmpeg');
  if (installer?.path) {
    process.env.FFMPEG_PATH = installer.path;
  }
} catch {
  // ignore
}

export type MusicBotAgent = {
  tokenHint: string;
  client: Client;
  busy: boolean;
  currentGuildId: string | null;
  currentVoiceChannelId: string | null;
};

const agents: MusicBotAgent[] = [];
let poolStarted = false;

// Track which voice channels are currently occupied (by any bot including primary)
const occupiedChannels = new Set<string>();

export function isChannelOccupied(guildId: string, voiceChannelId: string): boolean {
  return occupiedChannels.has(`${guildId}:${voiceChannelId}`);
}

export function markChannelOccupied(guildId: string, voiceChannelId: string) {
  occupiedChannels.add(`${guildId}:${voiceChannelId}`);
}

export function markChannelFree(guildId: string, voiceChannelId: string) {
  occupiedChannels.delete(`${guildId}:${voiceChannelId}`);
}

function maskToken(token: string) {
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function createMusicClient() {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    partials: [Partials.Channel, Partials.GuildMember],
  });
}

function parseTokens(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function startMusicBotPool() {
  if (poolStarted) return agents;
  poolStarted = true;

  const primaryToken = process.env.DISCORD_TOKEN?.trim();
  const extraTokens = parseTokens(process.env.MUSIC_BOT_TOKENS).filter(
    (token) => token !== primaryToken,
  );

  for (const token of extraTokens) {
    const client = createMusicClient();
    const agent: MusicBotAgent = {
      tokenHint: maskToken(token),
      client,
      busy: false,
      currentGuildId: null,
      currentVoiceChannelId: null,
    };

    client.once('ready', () => {
      console.log(`[music-pool] ✅ Agent ready: ${client.user?.tag} (${agent.tokenHint})`);
    });

    try {
      await client.login(token);
      agents.push(agent);
    } catch (error) {
      console.error(`[music-pool] ❌ Agent login failed (${agent.tokenHint}):`, error);
      client.destroy();
    }
  }

  console.log(`[music-pool] Started ${agents.length} extra music bot(s).`);
  return agents;
}

export function getMusicAgents() {
  return agents;
}

export function acquireFreeMusicAgent(guildId: string): MusicBotAgent | null {
  const free = agents.find((agent) => !agent.busy && agent.client.guilds.cache.has(guildId));
  if (!free) return null;
  free.busy = true;
  free.currentGuildId = guildId;
  return free;
}

export function releaseMusicAgent(clientUserId: string | null | undefined) {
  if (!clientUserId) return;
  const agent = agents.find((item) => item.client.user?.id === clientUserId);
  if (!agent) return;
  agent.busy = false;
  agent.currentGuildId = null;
  agent.currentVoiceChannelId = null;
}

export function markMusicAgentVoice(clientUserId: string | null | undefined, guildId: string, voiceChannelId: string) {
  if (!clientUserId) return;
  const agent = agents.find((item) => item.client.user?.id === clientUserId);
  if (!agent) return;
  agent.busy = true;
  agent.currentGuildId = guildId;
  agent.currentVoiceChannelId = voiceChannelId;
}

export function getAgentGuild(clientUserId: string, guildId: string): Guild | null {
  const agent = agents.find((item) => item.client.user?.id === clientUserId);
  if (!agent) return null;
  return agent.client.guilds.cache.get(guildId) ?? null;
}
