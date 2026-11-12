import {
  AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus,
  createAudioPlayer, createAudioResource, entersState, joinVoiceChannel,
  type AudioPlayer, type VoiceConnection,
} from '@discordjs/voice';
import type { ChatInputCommandInteraction, GuildTextBasedChannel, GuildMember } from 'discord.js';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);
const SoundCloud = req('soundcloud-scraper');
const scClient = new SoundCloud.Client();

export type MusicTrack = { title: string; url: string; duration: string; thumbnail: string | null; author: string; requestedBy: string };
type State = { guildId: string; voiceChannelId: string; textChannel: GuildTextBasedChannel; connection: VoiceConnection; player: AudioPlayer; queue: MusicTrack[]; current: MusicTrack | null };

// Key = guildId:voiceChannelId — allows different songs in different voice channels
const states = new Map<string, State>();

function stateKey(gid: string, vcId: string) { return `${gid}:${vcId}`; }
function fmt(ms: number) { const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${String(sec).padStart(2, '0')}`; }

async function resolveTrack(query: string, requestedBy: string): Promise<MusicTrack> {
  const input = query.trim();

  // If it's a SoundCloud URL — resolve directly
  if (/soundcloud\.com\//.test(input)) {
    const info = await scClient.getSongInfo(input);
    return { title: info.title, url: info.url, duration: fmt(info.duration), thumbnail: info.thumbnail || null, author: info.author?.name || 'SoundCloud', requestedBy };
  }

  // Search SoundCloud
  const results = await scClient.search(input, 'track');
  if (!results || results.length === 0) throw new Error('Ничего не найдено на SoundCloud');

  // Filter: max 6 minutes (360 seconds = 360000ms)
  const MAX_MS = 6 * 60 * 1000;
  
  for (const r of results.slice(0, 10)) {
    try {
      const info = await scClient.getSongInfo(r.url);
      if (info.duration <= MAX_MS) {
        return { title: info.title, url: info.url, duration: fmt(info.duration), thumbnail: info.thumbnail || null, author: info.author?.name || 'SoundCloud', requestedBy };
      }
    } catch { /* try next */ }
  }

  // If nothing under 6min, take first result anyway
  const info = await scClient.getSongInfo(results[0].url);
  return { title: info.title, url: info.url, duration: fmt(info.duration), thumbnail: info.thumbnail || null, author: info.author?.name || 'SoundCloud', requestedBy };
}

async function send(s: State, c: string) { await s.textChannel.send(c).catch(() => {}); }

async function playNext(key: string) {
  const s = states.get(key); if (!s) return;
  const next = s.queue.shift() ?? null; s.current = next;
  if (!next) {
    await send(s, '📭 Очередь закончилась.');
    setTimeout(() => { const c = states.get(key); if (!c || c.current || c.queue.length > 0) return; c.player.stop(true); c.connection.destroy(); states.delete(key); }, 10_000);
    return;
  }
  try {
    const info = await scClient.getSongInfo(next.url);
    const stream = await info.downloadProgressive();
    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    resource.volume?.setVolume(0.8);
    s.player.play(resource);
    await send(s, `▶️ Сейчас играет: **${next.title}** — ${next.duration}`);
  } catch (e) {
    console.error('[music] Stream error:', e); await send(s, `❌ Ошибка: ${e instanceof Error ? e.message : e}`);
    s.current = null; await playNext(key);
  }
}

function createState(member: GuildMember, interaction: ChatInputCommandInteraction): State {
  const vcId = member.voice.channelId!;
  const key = stateKey(member.guild.id, vcId);
  const connection = joinVoiceChannel({ channelId: vcId, guildId: member.guild.id, adapterCreator: member.guild.voiceAdapterCreator as any, selfDeaf: true, selfMute: false });
  const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
  connection.subscribe(player);
  const s: State = { guildId: member.guild.id, voiceChannelId: vcId, textChannel: interaction.channel as GuildTextBasedChannel, connection, player, queue: [], current: null };
  player.on(AudioPlayerStatus.Idle, () => void playNext(key));
  player.on('error', (e) => { console.error('[music] Player error:', e.message); void send(s, `❌ ${e.message}`); s.current = null; void playNext(key); });
  connection.on('error', (e) => { console.error('[music] Voice error:', e.message); });
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try { await Promise.race([entersState(connection, VoiceConnectionStatus.Signalling, 5_000), entersState(connection, VoiceConnectionStatus.Connecting, 5_000)]); }
    catch { connection.destroy(); states.delete(key); }
  });
  states.set(key, s);
  return s;
}

export async function enqueueMusic(interaction: ChatInputCommandInteraction, member: GuildMember, query: string) {
  const vcId = member.voice.channelId!;
  const key = stateKey(interaction.guildId!, vcId);
  let s = states.get(key);
  if (!s) { s = createState(member, interaction); await entersState(s.connection, VoiceConnectionStatus.Ready, 20_000); }
  const track = await resolveTrack(query, interaction.user.username);
  s.queue.push(track);
  if (!s.current) await playNext(key);
  return track;
}

export function skipMusic(guildId: string, vcId: string) { const s = states.get(stateKey(guildId, vcId)); if (!s?.current) return null; const c = s.current; s.player.stop(); return c; }
export function stopMusic(guildId: string, vcId: string) { const key = stateKey(guildId, vcId); const s = states.get(key); if (!s) return false; s.queue = []; s.current = null; s.player.stop(true); s.connection.destroy(); states.delete(key); return true; }
export function getMusicQueue(guildId: string, vcId: string) { return states.get(stateKey(guildId, vcId)) ?? null; }
