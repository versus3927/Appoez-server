import type { NextConfig } from "next";

const externalBotPackages = [
    'discord.js',
    '@discordjs/voice',
    '@discordjs/opus',
    'opusscript',
    'discord-player',
    'discord-player-youtubei',
    'simple-ytdl-core',
    '@discord-player/extractor',
    '@discord-player/utils',
    '@discord-player/ffmpeg',
    '@discord-player/equalizer',
    'discord-voip',
    'ffmpeg-static',
    '@ffmpeg-installer/ffmpeg',
    '@ffmpeg-installer/linux-x64',
    'libsodium-wrappers',
    'zlib-sync',
    'bufferutil',
    'utf-8-validate',
];

const nextConfig: NextConfig = {
    serverExternalPackages: externalBotPackages,
};

export default nextConfig;
