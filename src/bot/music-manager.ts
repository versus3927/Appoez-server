import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection,
} from '@discordjs/voice';
import type { ChatInputCommandInteraction, Guild, GuildTextBasedChannel, GuildMember } from 'discord.js';
import { client as primaryClient } from './client';
import {
  acquireFreeMusicAgent,
  getMusicAgents,
  markMusicAgentVoice,
  releaseMusicAgent,
  type MusicBotAgent,
  isChannelOccupied,
  markChannelFree,
  markChannelOccupied,
} from './music-bot-pool';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const SoundCloud = req('soundcloud-scraper');
const scClient = new SoundCloud.Client();

export type MusicTrack = {
  title: string;
  url: string;
  duration: string;
  thumbnail: string | null;
  author: string;
  requestedBy: string;
};

type State = {
  key: string;
  guildId: string;
  voiceChannelId: string;
  textChannel: GuildTextBasedChannel;
  guildForVoice: Guild;
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: MusicTrack[];
  current: MusicTrack | null;
  agentUserId: string | null;
  agentTag: string;
};

const states = new Map<string, State>();

function stateKey(guildId: string, voiceChannelId: string) {
  return `${guildId}:${voiceChannelId}`;
}

function fmt(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

async function resolveTrack(query: string, requestedBy: string): Promise<MusicTrack> {
  const input = query.trim();

  if (/soundcloud\.com\//i.test(input)) {
    const info = await scClient.getSongInfo(input);
    return {
      title: info.title,
      url: info.url,
      duration: fmt(info.duration),
      thumbnail: info.thumbnail || null,
      author: info.author?.name || 'SoundCloud',
      requestedBy,
    };
  }

  const results = await scClient.search(input, 'track');
  if (!results?.length) throw new Error('Ничего не найдено на SoundCloud');

  const MAX_MS = 6 * 60 * 1000;
  for (const result of results.slice(0, 10)) {
    try {
      const info = await scClient.getSongInfo(result.url);
      if (info.duration <= MAX_MS) {
        return {
          title: info.title,
          url: info.url,
          duration: fmt(info.duration),
          thumbnail: info.thumbnail || null,
          author: info.author?.name || 'SoundCloud',
          requestedBy,
        };
      }
    } catch {
      // try next result
    }
  }

  throw new Error('На SoundCloud не найдено треков короче 6 минут');
}

async function send(state: State, content: string) {
  await state.textChannel.send(content).catch(() => {});
}

async function playNext(key: string): Promise<void> {
  const state = states.get(key);
  if (!state) return;

  const next = state.queue.shift() ?? null;
  state.current = next;

  if (!next) {
    await send(state, `📭 Очередь закончилась. Музыкальный бот **${state.agentTag}** освобождён.`);
    setTimeout(() => {
      const current = states.get(key);
      if (!current || current.current || current.queue.length > 0) return;
      current.player.stop(true);
      current.connection.destroy();
      releaseMusicAgent(current.agentUserId);
      markChannelFree(current.guildId, current.voiceChannelId);
      states.delete(key);
    }, 10_000);
    return;
  }

  try {
    const info = await scClient.getSongInfo(next.url);
    const stream = await info.downloadHLS();
    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(0.8);
    state.player.play(resource);
    await send(state, `▶️ Сейчас играет: **${next.title}** — ${next.duration} • Бот: **${state.agentTag}**`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[music] Stream error:', message);
    await send(state, `❌ Ошибка потока: ${message}`);
    state.current = null;
    await playNext(key);
  }
}

function chooseVoiceGuild(member: GuildMember): { guild: Guild; agent: MusicBotAgent | null } {
  // Always prefer a pool agent. NEVER fall back to primary bot when pool exists —
  // primary bot can only be in one voice channel at a time and will "jump" between channels.
  const agent = acquireFreeMusicAgent(member.guild.id);
  if (agent) {
    const agentGuild = agent.client.guilds.cache.get(member.guild.id);
    if (agentGuild) {
      console.log(`[music] Assigned agent ${agent.client.user?.tag} to voice ${member.voice.channelId}`);
      return { guild: agentGuild, agent };
    }
    releaseMusicAgent(agent.client.user?.id);
  }

  // If pool is configured but all agents are busy — don't use primary bot
  const poolAgents = getMusicAgents();
  if (poolAgents.length > 0) {
    throw new Error('Все музыкальные боты заняты! Подожди пока один освободится.');
  }

  // No pool configured — use primary bot (single-channel mode)
  return { guild: member.guild, agent: null };
}

function createState(member: GuildMember, interaction: ChatInputCommandInteraction): State {
  const voiceChannelId = member.voice.channelId!;
  const key = stateKey(member.guild.id, voiceChannelId);
  const { guild: voiceGuild, agent } = chooseVoiceGuild(member);

  const connection = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId: voiceGuild.id,
    adapterCreator: voiceGuild.voiceAdapterCreator as any,
    selfDeaf: true,
    selfMute: false,
  });

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });

  connection.subscribe(player);

  const state: State = {
    key,
    guildId: member.guild.id,
    voiceChannelId,
    textChannel: interaction.channel as GuildTextBasedChannel,
    guildForVoice: voiceGuild,
    connection,
    player,
    queue: [],
    current: null,
    agentUserId: agent?.client.user?.id ?? primaryClient.user?.id ?? null,
    agentTag: agent?.client.user?.tag ?? primaryClient.user?.tag ?? 'Community bot',
  };

  if (agent?.client.user?.id) {
    markMusicAgentVoice(agent.client.user.id, member.guild.id, voiceChannelId);
  }

  player.on(AudioPlayerStatus.Idle, () => {
    void playNext(key);
  });

  player.on('error', (error) => {
    console.error('[music] Player error:', error.message);
    void send(state, `❌ ${error.message}`);
    state.current = null;
    void playNext(key);
  });

  connection.on('error', (error) => {
    console.error('[music] Voice error:', error.message);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
      releaseMusicAgent(state.agentUserId);
      markChannelFree(state.guildId, state.voiceChannelId);
      states.delete(key);
    }
  });

  markChannelOccupied(member.guild.id, voiceChannelId);
  states.set(key, state);
  return state;
}

export async function enqueueMusic(
  interaction: ChatInputCommandInteraction,
  member: GuildMember,
  query: string,
) {
  const voiceChannelId = member.voice.channelId!;
  const key = stateKey(interaction.guildId!, voiceChannelId);
  let state = states.get(key);

  if (!state) {
    state = createState(member, interaction);
    await entersState(state.connection, VoiceConnectionStatus.Ready, 20_000);
  }

  const track = await resolveTrack(query, interaction.user.username);
  state.queue.push(track);

  if (!state.current) {
    await playNext(key);
  }

  return { ...track, agentTag: state.agentTag };
}

export function skipMusic(guildId: string, voiceChannelId: string) {
  const state = states.get(stateKey(guildId, voiceChannelId));
  if (!state?.current) return null;
  const current = state.current;
  state.player.stop();
  return current;
}

export function stopMusic(guildId: string, voiceChannelId: string) {
  const key = stateKey(guildId, voiceChannelId);
  const state = states.get(key);
  if (!state) return false;
  state.queue = [];
  state.current = null;
  state.player.stop(true);
  state.connection.destroy();
  releaseMusicAgent(state.agentUserId);
  markChannelFree(state.guildId, state.voiceChannelId);
  states.delete(key);
  return true;
}

export function getMusicQueue(guildId: string, voiceChannelId: string) {
  return states.get(stateKey(guildId, voiceChannelId)) ?? null;
}
