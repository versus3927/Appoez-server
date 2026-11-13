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
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';

const req = createRequire(import.meta.url);
const { Ytdl } = req('@distube/ytdl-core');

let ytdlInstance: any = null;
function getYtdl() {
  if (!ytdlInstance) ytdlInstance = new Ytdl();
  return ytdlInstance;
}

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
  ffmpeg: ChildProcessWithoutNullStreams | null;
};

const states = new Map<string, State>();

function stateKey(guildId: string, voiceChannelId: string) {
  return `${guildId}:${voiceChannelId}`;
}

function fmtSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const MAX_DURATION_SEC = 4 * 60 * 60; // 4 hours

async function resolveTrack(query: string, requestedBy: string): Promise<MusicTrack> {
  const input = query.trim();
  const ytdl = getYtdl();

  const toTrack = (info: any, fallbackUrl: string): MusicTrack => {
    const dur = parseInt(info.videoDetails?.lengthSeconds ?? '0', 10);
    return {
      title: info.videoDetails?.title ?? 'Без названия',
      url: info.videoDetails?.video_url ?? fallbackUrl,
      duration: dur > 0 ? fmtSeconds(dur) : '??:??',
      thumbnail: info.videoDetails?.thumbnails?.[0]?.url ?? null,
      author: info.videoDetails?.author?.name ?? 'YouTube',
      requestedBy,
    };
  };

  // Direct YouTube URL
  if (/(?:youtube\.com|youtu\.be)\//i.test(input)) {
    const info = await ytdl.getInfo(input);
    const dur = parseInt(info.videoDetails?.lengthSeconds ?? '0', 10);
    if (dur <= 0) throw new Error('Не удалось определить длительность трека.');
    if (dur > MAX_DURATION_SEC) throw new Error(`Трек слишком длинный (${fmtSeconds(dur)}).`);
    return toTrack(info, input);
  }

  const tried = new Set<string>();
  const queries = [input, `${input} audio`, `${input} official audio`, `${input} song`];

  for (const searchQuery of queries) {
    const results = await ytdl.search(searchQuery);
    const items: any[] = Array.isArray(results) ? results : (results?.items ?? Object.values(results));
    if (!items?.length) continue;

    for (const item of items.slice(0, 25)) {
      try {
        const videoUrl = item.url ?? `https://www.youtube.com/watch?v=${item.id}`;
        if (!videoUrl || tried.has(videoUrl)) continue;
        tried.add(videoUrl);

        const info = await ytdl.getInfo(videoUrl);
        const dur = parseInt(info.videoDetails?.lengthSeconds ?? '0', 10);
        const isLive = Boolean(info.videoDetails?.isLiveContent) || dur <= 0;
        if (isLive) continue;
        if (dur > MAX_DURATION_SEC) continue;

        return toTrack(info, videoUrl);
      } catch {
        // try next result
      }
    }
  }

  throw new Error('Не удалось найти подходящий трек. Попробуй точнее написать название или вставить ссылку.');
}

function getFfmpegPath(): string {
  return process.env.FFMPEG_PATH ?? '/app/node_modules/@ffmpeg-installer/linux-x64/ffmpeg';
}

async function send(state: State, content: string) {
  await state.textChannel.send(content).catch(() => {});
}

async function playNext(key: string): Promise<void> {
  const state = states.get(key);
  if (!state) return;

  // Kill previous ffmpeg if lingering
  if (state.ffmpeg) {
    state.ffmpeg.kill('SIGKILL');
    state.ffmpeg = null;
  }

  const next = state.queue.shift() ?? null;
  state.current = next;

  if (!next) {
    await send(state, `📭 Очередь закончилась.`);
    setTimeout(() => {
      const current = states.get(key);
      if (!current || current.current || current.queue.length > 0) return;
      current.player.stop(true);
      current.connection.destroy();
      releaseMusicAgent(current.agentUserId);
      markChannelFree(current.guildId, current.voiceChannelId);
      states.delete(key);
      console.log('[music] Released agent after queue timeout:', current.agentTag);
    }, 30_000);
    return;
  }

  try {
    const ytdl = getYtdl();

    // Download audio-only stream from YouTube
    const audioStream = ytdl.download(next.url, {
      filter: { hasAudio: true, hasVideo: false },
      quality: 'lowestaudio',
    });

    // Pipe through ffmpeg to convert to raw PCM for Discord voice
    const ffmpegProcess = spawn(getFfmpegPath(), [
      '-i', 'pipe:0',
      '-vn',
      '-loglevel', 'error',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    state.ffmpeg = ffmpegProcess;

    audioStream.pipe(ffmpegProcess.stdin);

    // Handle errors gracefully
    audioStream.on('error', (err: Error) => {
      console.error('[music] ytdl stream error:', err.message);
      ffmpegProcess.stdin.end();
    });
    ffmpegProcess.stdin.on('error', () => { /* ignore broken pipe */ });
    ffmpegProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) console.error('[music] ffmpeg:', text);
    });
    ffmpegProcess.on('exit', (code, signal) => {
      console.log('[music] ffmpeg exit:', { code, signal, track: next.title });
    });

    const resource = createAudioResource(ffmpegProcess.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true,
    });
    resource.volume?.setVolume(0.8);

    state.player.play(resource);
    await send(state, `▶️ Сейчас играет: **${next.title}** — ${next.duration}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[music] Stream error:', message);
    await send(state, `❌ Ошибка потока: ${message}`);
    state.current = null;
    await playNext(key);
  }
}

async function chooseVoiceGuild(member: GuildMember): Promise<{ guild: Guild; agent: MusicBotAgent }> {
  const agent = acquireFreeMusicAgent(member.guild.id);
  if (!agent) {
    throw new Error('Все музыкальные боты заняты! Подожди, пока один освободится.');
  }

  // Ensure we can access this guild with this agent
  let agentGuild = agent.client.guilds.cache.get(member.guild.id);
  if (!agentGuild) {
    try {
      agentGuild = await agent.client.guilds.fetch(member.guild.id);
    } catch {
      console.error(`[music] Agent ${agent.client.user?.tag} can't access guild ${member.guild.id}`);
      releaseMusicAgent(agent.client.user?.id);
      // Recurse once to try another agent if available
      return await chooseVoiceGuild(member);
    }
  }

  return { guild: agentGuild, agent };
}

async function createState(member: GuildMember, interaction: ChatInputCommandInteraction): Promise<State> {
  const voiceChannelId = member.voice.channelId!;
  const key = stateKey(member.guild.id, voiceChannelId);
  const { guild: voiceGuild, agent } = await chooseVoiceGuild(member);
  console.log(`[music] Creating state for voice ${voiceChannelId} with ${agent.client.user?.tag}`);

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
    agentUserId: agent.client.user?.id ?? null,
    agentTag: agent.client.user?.tag ?? 'Community bot',
    ffmpeg: null,
  };

  if (agent.client.user?.id) {
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
    // Check if the primary bot OR any agent is already in this channel but we don't have a state for it
    // This could happen after a crash/restart.
    // However, createState will now correctly pick the first free agent or one that might already be there.
    state = await createState(member, interaction);
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
  if (state.ffmpeg) { state.ffmpeg.kill('SIGKILL'); state.ffmpeg = null; }
  state.player.stop();
  return current;
}

export function stopMusic(guildId: string, voiceChannelId: string) {
  const key = stateKey(guildId, voiceChannelId);
  const state = states.get(key);
  if (!state) return false;
  state.queue = [];
  state.current = null;
  if (state.ffmpeg) { state.ffmpeg.kill('SIGKILL'); state.ffmpeg = null; }
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
