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
import { Ytdl } from '@distube/ytdl-core';
import type { ChatInputCommandInteraction, GuildTextBasedChannel, GuildMember } from 'discord.js';
import yts from 'yt-search';

export type MusicTrack = {
  title: string;
  url: string;
  duration: string;
  thumbnail: string | null;
  author: string;
  requestedBy: string;
};

type GuildMusicState = {
  guildId: string;
  voiceChannelId: string;
  textChannel: GuildTextBasedChannel;
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: MusicTrack[];
  current: MusicTrack | null;
};

const states = new Map<string, GuildMusicState>();
const ytdl = new Ytdl();

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '?';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isYoutubeUrl(value: string): boolean {
  return /youtu\.be|youtube\.com/i.test(value);
}

async function resolveTrack(query: string, requestedBy: string): Promise<MusicTrack> {
  const input = query.trim();

  if (isYoutubeUrl(input)) {
    const info = await ytdl.getInfo(input);
    const details = info.videoDetails;
    return {
      title: details.title,
      url: details.url,
      duration: formatDuration(details.lengthSeconds),
      thumbnail: details.thumbnails?.[0]?.url ?? null,
      author: details.author?.name ?? 'YouTube',
      requestedBy,
    };
  }

  const search = await yts(input);
  const video = search.videos[0];
  if (!video) {
    throw new Error('Ничего не найдено по этому запросу');
  }

  return {
    title: video.title,
    url: video.url,
    duration: video.timestamp || formatDuration(video.seconds ?? 0),
    thumbnail: video.thumbnail || null,
    author: video.author?.name || 'YouTube',
    requestedBy,
  };
}

async function send(state: GuildMusicState, content: string) {
  await state.textChannel.send(content).catch(() => {});
}

async function playNext(guildId: string): Promise<void> {
  const state = states.get(guildId);
  if (!state) return;

  const next = state.queue.shift() ?? null;
  state.current = next;

  if (!next) {
    await send(state, '📭 Очередь закончилась. До скорой встречи!');
    setTimeout(() => {
      const currentState = states.get(guildId);
      if (!currentState) return;
      if (currentState.current || currentState.queue.length > 0) return;
      currentState.player.stop(true);
      currentState.connection.destroy();
      states.delete(guildId);
    }, 10_000);
    return;
  }

  try {
    const stream = ytdl.download(next.url, {
      filter: (format: any) => format.hasAudio && !format.hasVideo,
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    } as any);

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(0.8);

    state.player.play(resource);
    await send(state, `▶️ Сейчас играет: **${next.title}** — ${next.duration}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[music-manager] Stream failed:', message);
    await send(state, `❌ Ошибка потока: ${message}`);
    state.current = null;
    await playNext(guildId);
  }
}

function createState(member: GuildMember, interaction: ChatInputCommandInteraction): GuildMusicState {
  const connection = joinVoiceChannel({
    channelId: member.voice.channelId!,
    guildId: member.guild.id,
    adapterCreator: member.guild.voiceAdapterCreator as any,
    selfDeaf: true,
    selfMute: false,
  });

  const player = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Pause,
    },
  });

  connection.subscribe(player);

  const state: GuildMusicState = {
    guildId: member.guild.id,
    voiceChannelId: member.voice.channelId!,
    textChannel: interaction.channel as GuildTextBasedChannel,
    connection,
    player,
    queue: [],
    current: null,
  };

  player.on(AudioPlayerStatus.Idle, () => {
    void playNext(state.guildId);
  });

  player.on('error', (error) => {
    console.error('[music-manager] AudioPlayer error:', error.message);
    void send(state, `❌ Аудио-плеер: ${error.message}`);
    state.current = null;
    void playNext(state.guildId);
  });

  connection.on('error', (error) => {
    console.error('[music-manager] Voice connection error:', error.message);
    void send(state, `❌ Голосовое подключение: ${error.message}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      connection.destroy();
      states.delete(state.guildId);
    }
  });

  states.set(state.guildId, state);
  return state;
}

export async function enqueueMusic(interaction: ChatInputCommandInteraction, member: GuildMember, query: string) {
  let state = states.get(interaction.guildId!);

  if (state && state.voiceChannelId !== member.voice.channelId) {
    throw new Error('Бот уже играет в другом голосовом канале');
  }

  if (!state) {
    state = createState(member, interaction);
    await entersState(state.connection, VoiceConnectionStatus.Ready, 20_000);
  }

  const track = await resolveTrack(query, interaction.user.username);
  state.queue.push(track);

  if (!state.current) {
    await playNext(state.guildId);
  }

  return track;
}

export function skipMusic(guildId: string) {
  const state = states.get(guildId);
  if (!state || !state.current) return null;
  const current = state.current;
  state.player.stop();
  return current;
}

export function stopMusic(guildId: string) {
  const state = states.get(guildId);
  if (!state) return false;
  state.queue = [];
  state.current = null;
  state.player.stop(true);
  state.connection.destroy();
  states.delete(guildId);
  return true;
}

export function getMusicQueue(guildId: string) {
  return states.get(guildId) ?? null;
}
