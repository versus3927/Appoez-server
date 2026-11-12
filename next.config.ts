import type { NextConfig } from 'next';

const externalBotPackages = [
  'discord.js',
  '@discordjs/voice',
  '@discordjs/opus',
  'opusscript',
  'play-dl',
  '@distube/ytdl-core',
  'yt-search',
  '@ffmpeg-installer/ffmpeg',
  '@ffmpeg-installer/linux-x64',
  'ffmpeg-static',
  'libsodium-wrappers',
  'bufferutil',
  'utf-8-validate',
  'zlib-sync',
  // legacy packages kept external to avoid accidental bundling
  'discord-player',
  'discord-player-youtubei',
  'simple-ytdl-core',
  '@discord-player/extractor',
  '@discord-player/utils',
  '@discord-player/ffmpeg',
  '@discord-player/equalizer',
  'discord-voip',
];

const nextConfig: NextConfig = {
  serverExternalPackages: externalBotPackages,
};

export default nextConfig;
