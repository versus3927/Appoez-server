/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * YouTube extractor loader.
 * Uses createRequire so Turbopack doesn't statically analyze the import
 * and try to bundle discord-player-youtubei / simple-ytdl-core.
 */
import { createRequire } from 'module';

const req = createRequire(import.meta.url);

export function loadYoutubeExtractor(): {
    YoutubeExtractor: { new(...args: unknown[]): unknown; identifier: string };
} | null {
    try {
        // Using createRequire bypasses Turbopack's static import analysis
        const pkg = req('discord-player-youtubei');
        return pkg;
    } catch (err) {
        console.error('[youtube-loader] discord-player-youtubei not available:', err);
        return null;
    }
}
