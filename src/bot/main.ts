import { Events } from 'discord.js';
import { client, player } from './client';
import { handleInteraction } from './events/interactionCreate';
import { handleVoiceStateUpdate } from './events/voiceStateUpdate';
import { handleMessageCreate } from './events/messageCreate';
import { deployCommands } from './deploy-commands';
import { DefaultExtractors } from '@discord-player/extractor';

let startPromise: Promise<boolean> | null = null;

/**
 * Idempotent bot bootstrap. Safe to call multiple times (instrumentation
 * hook on boot, /api/bot-start as a manual fallback) — the login flow runs
 * only once per process.
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
            await player.extractors.loadMulti(DefaultExtractors);

            client.once(Events.ClientReady, (readyClient) => {
                console.log(`[bot] Logged in as ${readyClient.user.tag}`);
                void deployCommands().catch((error) =>
                    console.error('[bot] Failed to deploy slash commands:', error)
                );
            });

            // Errors inside event handlers must never crash the web process.
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
