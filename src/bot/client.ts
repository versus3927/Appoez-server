import { createRequire } from 'module';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const req = createRequire(import.meta.url);

try {
  const installer = req('@ffmpeg-installer/ffmpeg');
  if (installer?.path) {
    process.env.FFMPEG_PATH = installer.path;
    console.log('[bot] ✅ ffmpeg path set:', installer.path);
  }
} catch (error) {
  console.error('[bot] ⚠️  @ffmpeg-installer/ffmpeg not found:', error);
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});
