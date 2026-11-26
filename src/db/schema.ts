import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  primaryKey,
  numeric,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  handle: varchar("handle", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 60 }).notNull(),
  avatarUrl: text("avatar_url").notNull().default(""),
  bio: text("bio").notNull().default(""),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("approved"),
  moderationReason: text("moderation_reason"),
  moderatedAt: timestamp("moderated_at"),
  recheckCount: integer("recheck_count").notNull().default(0),
  nextRecheckAt: timestamp("next_recheck_at"),
  caption: text("caption").notNull().default(""),
  musicName: varchar("music_name", { length: 120 }).notNull().default("original sound"),
  videoUrl: text("video_url").notNull().default(""),
  coverUrl: text("cover_url"),
  mediaUrls: text("media_urls"),
  mediaId: varchar("media_id", { length: 120 }),
  coverMediaId: varchar("cover_media_id", { length: 120 }),
  storageProvider: varchar("storage_provider", { length: 24 }).notNull().default("local"),
  viewsCount: integer("views_count").notNull().default(0),
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  savesCount: integer("saves_count").notNull().default(0),
  sharesCount: integer("shares_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const likes = pgTable(
  "likes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })]
);

export const saves = pgTable(
  "saves",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })]
);

export const follows = pgTable(
  "follows",
  {
    followerId: integer("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followingId] })]
);

export const moderationLogs = pgTable("moderation_logs", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").references(() => videos.id, { onDelete: "set null" }),
  action: text("action").notNull().default("checked"),
  status: text("status").notNull(),
  authorHandle: varchar("author_handle", { length: 40 }),
  captionSnapshot: text("caption_snapshot"),
  imageScore: numeric("image_score", { precision: 6, scale: 4 }),
  textScore: numeric("text_score", { precision: 6, scale: 4 }),
  imageVerdict: text("image_verdict"),
  textVerdict: text("text_verdict"),
  reason: text("reason"),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedBy: varchar("reviewed_by", { length: 60 }),
  reviewedAt: timestamp("reviewed_at"),
});

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").references(() => videos.id, { onDelete: "set null" }),
  reporterId: integer("reporter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 120 }).notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 24 }).notNull().default("local"),
  remoteId: varchar("remote_id", { length: 120 }),
  url: text("url").notNull(),
  fileName: varchar("file_name", { length: 200 }).notNull().default(""),
  mimeType: varchar("mime_type", { length: 100 }).notNull().default(""),
  kind: varchar("kind", { length: 16 }).notNull().default("image"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  videoId: integer("video_id").references(() => videos.id, { onDelete: "set null" }),
  uploadedBy: varchar("uploaded_by", { length: 40 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
