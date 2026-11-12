import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: [
        'discord.js',
        '@discordjs/voice',
        '@discordjs/opus',
        'opusscript',
        'discord-player',
        '@discord-player/extractor',
        'ffmpeg-static',
        'libsodium-wrappers',
        'zlib-sync',
        'bufferutil',
        'utf-8-validate',
    ],
};

export default nextConfig;
