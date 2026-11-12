import {
  AudioPlayerStatus, NoSubscriberBehavior, StreamType, VoiceConnectionStatus,
  createAudioPlayer, createAudioResource, entersState, joinVoiceChannel,
  type AudioPlayer, type VoiceConnection,
} from '@discordjs/voice';
import { Ytdl } from '@distube/ytdl-core';
import type { ChatInputCommandInteraction, GuildTextBasedChannel, GuildMember } from 'discord.js';
import yts from 'yt-search';

export type MusicTrack = { title: string; url: string; duration: string; thumbnail: string | null; author: string; requestedBy: string };
type State = { guildId: string; voiceChannelId: string; textChannel: GuildTextBasedChannel; connection: VoiceConnection; player: AudioPlayer; queue: MusicTrack[]; current: MusicTrack | null };

// Key = guildId:voiceChannelId — allows different songs in different voice channels
const states = new Map<string, State>();
const ytdl = new Ytdl();

function stateKey(guildId: string, vcId: string) { return `${guildId}:${vcId}`; }
function fmt(s: number) { if (!s || s <= 0) return '?'; const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`; }

async function resolveTrack(query: string, requestedBy: string): Promise<MusicTrack> {
  const input = query.trim();
  // Search YouTube specifically for MUSIC category
  const results = await yts(input + ' music audio');
  // Filter: prefer videos with "music" category hints, short duration (< 15min), and skip podcasts/lectures
  const video = results.videos.filter(v => {
    if (!v.seconds || v.seconds > 900) return false; // skip videos longer than 15 min
    const title = (v.title || '').toLowerCase();
    // skip obvious non-music
    if (title.includes('podcast') || title.includes('lecture') || title.includes('tutorial') || title.includes('review')) return false;
    return true;
  })[0] || results.videos[0];
  
  if (!video) throw new Error('Ничего не найдено');
  return { title: video.title, url: video.url, duration: video.timestamp || fmt(video.seconds ?? 0), thumbnail: video.thumbnail || null, author: video.author?.name || 'YouTube', requestedBy };
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
    const stream = ytdl.download(next.url, { filter: (f: any) => f.hasAudio && !f.hasVideo, quality: 'highestaudio', highWaterMark: 1 << 25 } as any);
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
  connection.on(VoiceConnectionStatus.Disconnected, async () => { try { await Promise.race([entersState(connection, VoiceConnectionStatus.Signalling, 5_000), entersState(connection, VoiceConnectionStatus.Connecting, 5_000)]); } catch { connection.destroy(); states.delete(key); } });
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
