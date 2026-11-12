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
    'libsodium-wrappers',
    'zlib-sync',
    'bufferutil',
    'utf-8-validate',
];

const nextConfig: NextConfig = {
    serverExternalPackages: externalBotPackages,
    // Turbopack exclusions — prevents bundling of CJS packages
    turbopack: {
        resolveAlias: Object.fromEntries(
            externalBotPackages.map(pkg => [pkg, { browser: pkg, default: pkg }])
        ),
    },
};

export default nextConfig;
