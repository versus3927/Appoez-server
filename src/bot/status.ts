import { client } from './client';
import { isBotStartupTriggered } from './main';

export type BotStatus = {
    startupTriggered: boolean;
    ready: boolean;
    tag: string | null;
    guilds: number;
};

export function getBotStatus(): BotStatus {
    return {
        startupTriggered: isBotStartupTriggered(),
        ready: client.isReady(),
        tag: client.user?.tag ?? null,
        guilds: client.guilds?.cache.size ?? 0,
    };
}
