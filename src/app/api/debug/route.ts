import { getDb } from "@/db";
import { guildConfigs } from "@/db/schema";
import { getBotStatus } from "@/bot/status";
import { client } from "@/bot/client";
import { ChannelType } from "discord.js";

export const dynamic = "force-dynamic";

export async function GET() {
    const bot = getBotStatus();
    const database = getDb();

    const diag: Record<string, unknown> = {
        bot,
        ffmpegPath: process.env.FFMPEG_PATH ?? "NOT SET",
        nodeVersion: process.version,
    };

    // Check all guild configs from DB
    if (database) {
        try {
            const configs = await database.select().from(guildConfigs);
            diag.guildConfigs = configs;

            // For each config, try to verify channels exist
            if (client.isReady() && configs.length > 0) {
                const verifications = [];
                for (const cfg of configs) {
                    const guild = client.guilds.cache.get(cfg.guildId);
                    if (!guild) {
                        verifications.push({ guildId: cfg.guildId, error: "Guild not in cache" });
                        continue;
                    }

                    const checks: Record<string, unknown> = {
                        guildId: cfg.guildId,
                        guildName: guild.name,
                    };

                    // Check voice-logs channel
                    if (cfg.logsChannelId) {
                        try {
                            const ch = await guild.channels.fetch(cfg.logsChannelId);
                            if (ch) {
                                checks.logsChannel = {
                                    id: ch.id,
                                    name: ch.name,
                                    type: ch.type,
                                    isText: ch.type === ChannelType.GuildText,
                                };

                                // Try to send a test message
                                if (ch.type === ChannelType.GuildText) {
                                    try {
                                        const msg = await (ch as any).send("🔧 **Диагностика:** Бот может писать в этот канал. Voice-logs работают.");
                                        checks.logsChannel = { ...checks.logsChannel as object, canSend: true, testMsgId: msg.id };
                                    } catch (sendErr: any) {
                                        checks.logsChannel = { ...checks.logsChannel as object, canSend: false, sendError: sendErr.message };
                                    }
                                }
                            } else {
                                checks.logsChannel = { error: "Channel fetch returned null" };
                            }
                        } catch (fetchErr: any) {
                            checks.logsChannel = { error: fetchErr.message };
                        }
                    } else {
                        checks.logsChannel = { error: "logsChannelId is null in DB" };
                    }

                    // Check welcome channel
                    if (cfg.welcomeChannelId) {
                        try {
                            const ch = await guild.channels.fetch(cfg.welcomeChannelId);
                            checks.welcomeChannel = ch ? { id: ch.id, name: ch.name, exists: true } : { error: "null" };
                        } catch (e: any) {
                            checks.welcomeChannel = { error: e.message };
                        }
                    }

                    // Check generator channel
                    if (cfg.generatorChannelId) {
                        try {
                            const ch = await guild.channels.fetch(cfg.generatorChannelId);
                            checks.generatorChannel = ch ? { id: ch.id, name: ch.name, exists: true } : { error: "null" };
                        } catch (e: any) {
                            checks.generatorChannel = { error: e.message };
                        }
                    }

                    verifications.push(checks);
                }
                diag.channelVerification = verifications;
            }
        } catch (dbErr: any) {
            diag.dbError = dbErr.message;
        }
    } else {
        diag.dbError = "Database not configured";
    }

    return Response.json(diag, { status: 200 });
}
