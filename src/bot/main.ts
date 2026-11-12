import { loadYoutubeExtractor } from './youtube-loader';
import { Events, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { client, player } from './client';
import { handleInteraction } from './events/interactionCreate';
import { handleVoiceStateUpdate } from './events/voiceStateUpdate';
import { handleMessageCreate } from './events/messageCreate';
import { handleGuildMemberAdd } from './events/guildMemberAdd';
import { deployCommands } from './deploy-commands';
import { DefaultExtractors } from '@discord-player/extractor';

let startPromise: Promise<boolean> | null = null;

function getTextChannel(interaction: ChatInputCommandInteraction | undefined): TextChannel | null {
    if (!interaction?.channel) return null;
    if ('send' in interaction.channel && typeof interaction.channel.send === 'function') {
        return interaction.channel as unknown as TextChannel;
    }
    return null;
}

export function startBot(): Promise<boolean> {
    if (startPromise) return startPromise;

    startPromise = (async () => {
        const token = process.env.DISCORD_TOKEN;
        if (!token) {
            console.error('[bot] DISCORD_TOKEN is missing — bot stays offline.');
            startPromise = null;
            return false;
        }

        try {
            await player.extractors.loadMulti(DefaultExtractors);

            try {
                const yt = loadYoutubeExtractor();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (yt) { await player.extractors.register(yt.YoutubeExtractor as any, {}); }
                console.log('[bot] ✅ YouTube extractor loaded.');
            } catch (err) {
                console.error('[bot] ⚠️ YouTube extractor failed:', err);
            }

            // ── Player Events ──
            player.events.on('playerStart', (queue, track) => {
                console.log(`[player] ▶️ Now playing: ${track.title}`);
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send({
                    embeds: [{
                        title: '▶️ Сейчас играет',
                        description: `**[${track.title}](${track.url})**`,
                        color: 0x8B5CF6,
                        thumbnail: track.thumbnail ? { url: track.thumbnail } : undefined,
                        fields: [
                            { name: '👤 Автор', value: track.author || '?', inline: true },
                            { name: '⏱️ Длительность', value: track.duration || '?', inline: true },
                        ],
                    }]
                }).catch(() => {});
            });

            player.events.on('emptyQueue', (queue) => {
                console.log('[player] 📭 Queue empty.');
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send('📭 Очередь закончилась. До скорой встречи!').catch(() => {});
            });

            player.events.on('error', (queue, error) => {
                console.error('[player] ❌ Queue error:', error.message);
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send(`❌ Ошибка очереди: ${error.message}`).catch(() => {});
            });

            player.events.on('playerError', (queue, error, track) => {
                console.error(`[player] ❌ Stream error on "${track.title}":`, error.message);
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send(`❌ Ошибка потока при воспроизведении **${track.title}**: ${error.message}`).catch(() => {});
            });

            // ── Client Events ──
            client.once(Events.ClientReady, (readyClient) => {
                console.log(`[bot] ✅ Logged in as ${readyClient.user.tag}`);
                void deployCommands().catch((error) =>
                    console.error('[bot] Failed to deploy slash commands:', error)
                );
            });

            client.on(Events.InteractionCreate, (interaction) =>
                void handleInteraction(interaction).catch((error) =>
                    console.error('[bot] interactionCreate error:', error)
                )
            );
            client.on(Events.VoiceStateUpdate, (oldState, newState) =>
                void handleVoiceStateUpdate(oldState, newState).catch((error) =>
                    console.error('[bot] voiceStateUpdate error:', error)
                )
            );
            client.on(Events.MessageCreate, (message) =>
                void handleMessageCreate(message).catch((error) =>
                    console.error('[bot] messageCreate error:', error)
                )
            );
            client.on(Events.GuildMemberAdd, (member) =>
                void handleGuildMemberAdd(member).catch((error) =>
                    console.error('[bot] guildMemberAdd error:', error)
                )
            );

            await client.login(token);
            return true;
        } catch (error) {
            console.error('[bot] Failed to start:', error);
            startPromise = null;
            return false;
        }
    })();

    return startPromise;
}

export function isBotStartupTriggered(): boolean {
    return startPromise !== null;
}
