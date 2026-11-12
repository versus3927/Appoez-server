import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const userStats = pgTable("user_stats", {
  userId: text("user_id").primaryKey(), // Discord ID
  guildId: text("guild_id").notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  voiceMinutes: integer("voice_minutes").default(0).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastVoiceJoin: timestamp("last_voice_join"),
});

export const privateRooms = pgTable("private_rooms", {
  channelId: text("channel_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  guildId: text("guild_id").notNull(),
});

export const guildConfigs = pgTable("guild_configs", {
  guildId: text("guild_id").primaryKey(),
  logsChannelId: text("logs_channel_id"),
  generatorChannelId: text("generator_channel_id"),
  categoryId: text("category_id"),
  welcomeChannelId: text("welcome_channel_id"),
  commandsChannelId: text("commands_channel_id"),
  musicChannelId: text("music_channel_id"),
});
