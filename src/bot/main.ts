import { Events, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { client, player } from './client';
import { handleInteraction } from './events/interactionCreate';
import { handleVoiceStateUpdate } from './events/voiceStateUpdate';
import { handleMessageCreate } from './events/messageCreate';
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

/**
 * Idempotent bot bootstrap. Safe to call multiple times — the login flow
 * runs only once per process.
 */
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
            // Load music extractors (YouTube, SoundCloud, etc.)
            await player.extractors.loadMulti(DefaultExtractors);
            console.log('[bot] Music extractors loaded.');

            // ── Player Events (critical for music playback) ──
            player.events.on('playerStart', (queue, track) => {
                console.log(`[player] ▶️ Now playing: ${track.title}`);
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send(`▶️ Сейчас играет: **${track.title}**`).catch(() => {});
            });

            player.events.on('playerFinish', (_queue, track) => {
                console.log(`[player] ✅ Finished: ${track.title}`);
            });

            player.events.on('emptyQueue', (queue) => {
                console.log('[player] 📭 Queue empty, leaving channel.');
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send('📭 Очередь закончилась.').catch(() => {});
            });

            player.events.on('emptyChannel', () => {
                console.log('[player] 👻 Channel empty, leaving.');
            });

            player.events.on('disconnect', () => {
                console.log('[player] 🔌 Disconnected from voice.');
            });

            player.events.on('error', (queue, error) => {
                console.error(`[player] ❌ Queue error:`, error);
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send(`❌ Ошибка воспроизведения: ${error.message}`).catch(() => {});
            });

            player.events.on('playerError', (queue, error, track) => {
                console.error(`[player] ❌ Player error on "${track.title}":`, error);
                const ch = getTextChannel(queue.metadata as ChatInputCommandInteraction | undefined);
                ch?.send(`❌ Ошибка при воспроизведении **${track.title}**: ${error.message}`).catch(() => {});
            });

            // ── Discord Client Events ──
            client.once(Events.ClientReady, (readyClient) => {
                console.log(`[bot] Logged in as ${readyClient.user.tag}`);
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

/** True once a startup attempt has been triggered in this process. */
export function isBotStartupTriggered(): boolean {
    return startPromise !== null;
}
