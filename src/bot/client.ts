import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Player } from 'discord-player';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);

// @ffmpeg-installer/ffmpeg bundles the ffmpeg binary — no postinstall needed.
// ffmpeg-static does NOT work on Railway because it requires postinstall to download the binary,
// which Railway skips with --ignore-scripts during CI builds.
try {
    const installer = req('@ffmpeg-installer/ffmpeg');
    if (installer?.path) {
        process.env.FFMPEG_PATH = installer.path;
        console.log('[bot] ✅ ffmpeg path set:', installer.path);
    }
} catch (e) {
    console.error('[bot] ⚠️  @ffmpeg-installer/ffmpeg not found:', e);
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
