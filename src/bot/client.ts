import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Player } from 'discord-player';

// Fallback to ffmpeg-static if system ffmpeg is missing
try {
    const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath) {
        process.env.FFMPEG_PATH = ffmpegPath;
        console.log('[bot] Set FFMPEG_PATH to ffmpeg-static:', ffmpegPath);
    }
} catch (e) {
    console.log('[bot] ffmpeg-static not found, relying on system ffmpeg.');
}

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

export const player = new Player(client, {
    skipFFmpeg: false,
});
