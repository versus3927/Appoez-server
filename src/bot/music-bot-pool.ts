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
let roundRobinIndex = 0;

let primaryAgent: MusicBotAgent | null = null;

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

function freeAgent(agent: MusicBotAgent) {
  agent.busy = false;
  agent.currentGuildId = null;
  agent.currentVoiceChannelId = null;
}

function healStaleAgentState(agent: MusicBotAgent) {
  if (!agent.busy) return;
  if (!agent.currentGuildId || !agent.currentVoiceChannelId) {
    freeAgent(agent);
    return;
  }

  const occupancyKey = `${agent.currentGuildId}:${agent.currentVoiceChannelId}`;
  const guild = agent.client.guilds.cache.get(agent.currentGuildId);
  const actualVoiceChannelId = guild?.members.me?.voice.channelId ?? null;

  // If our app no longer marks that voice channel occupied, or the bot is not in that channel anymore,
  // the agent is stale and should be freed.
  if (!occupiedChannels.has(occupancyKey) || actualVoiceChannelId !== agent.currentVoiceChannelId) {
    console.log(
      `[music-pool] ♻️ Releasing stale agent ${agent.client.user?.tag}: tracked=${agent.currentVoiceChannelId}, actual=${actualVoiceChannelId}`,
    );
    freeAgent(agent);
  }
}

export async function startMusicBotPool(primaryClient?: Client) {
  if (poolStarted) return agents;
  poolStarted = true;

  const primaryToken = process.env.DISCORD_TOKEN?.trim();

  if (primaryClient && primaryToken) {
    primaryAgent = {
      tokenHint: 'PRIMARY',
      client: primaryClient,
      busy: false,
      currentGuildId: null,
      currentVoiceChannelId: null,
    };
  }

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
  const allPossibleAgents = primaryAgent ? [primaryAgent, ...agents] : agents;

  // Heal stale states before allocation
  for (const agent of allPossibleAgents) {
    healStaleAgentState(agent);
  }

  if (allPossibleAgents.length === 0) return null;

  // First check if a bot is ALREADY in this specific voice channel for this guild
  // Though music-manager usually handles this via states Map, it doesn't hurt.

  // Round-robin selection so the first bot is not always preferred
  for (let i = 0; i < allPossibleAgents.length; i += 1) {
    const index = (roundRobinIndex + i) % allPossibleAgents.length;
    const agent = allPossibleAgents[index];
    if (!agent.busy && agent.client.isReady()) {
      agent.busy = true;
      agent.currentGuildId = guildId;
      roundRobinIndex = (index + 1) % allPossibleAgents.length;
      console.log(`[music-pool] Acquired agent: ${agent.client.user?.tag} for guild ${guildId} (Hint: ${agent.tokenHint})`);
      return agent;
    }
  }

  console.log(
    '[music-pool] No free agent. Status:',
    allPossibleAgents
      .map((agent) => `${agent.client.user?.tag ?? '?'}=${agent.busy ? 'BUSY' : 'FREE'}`)
      .join(', '),
  );
  return null;
}

export function releaseMusicAgent(clientUserId: string | null | undefined) {
  if (!clientUserId) return;
  const allPossibleAgents = primaryAgent ? [primaryAgent, ...agents] : agents;
  const agent = allPossibleAgents.find((item) => item.client.user?.id === clientUserId);
  if (!agent) return;
  freeAgent(agent);
}

export function markMusicAgentVoice(clientUserId: string | null | undefined, guildId: string, voiceChannelId: string) {
  if (!clientUserId) return;
  const allPossibleAgents = primaryAgent ? [primaryAgent, ...agents] : agents;
  const agent = allPossibleAgents.find((item) => item.client.user?.id === clientUserId);
  if (!agent) return;
  agent.busy = true;
  agent.currentGuildId = guildId;
  agent.currentVoiceChannelId = voiceChannelId;
}

export function getAgentGuild(clientUserId: string, guildId: string): Guild | null {
  const allPossibleAgents = primaryAgent ? [primaryAgent, ...agents] : agents;
  const agent = allPossibleAgents.find((item) => item.client.user?.id === clientUserId);
  if (!agent) return null;
  return agent.client.guilds.cache.get(guildId) ?? null;
}
