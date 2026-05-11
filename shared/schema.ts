import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Photos table to store metadata and paths
export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // e.g., 'image/jpeg', 'video/mp4'
  fileSize: integer("file_size").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  favorite: integer("favorite", { mode: "boolean" }).default(false),
  description: text("description"), // User provided description or "trace"
  location: text("location"), // Location name
  coordinates: text("coordinates", { mode: "json" }), // Lat/long coordinates {lat: number, lng: number}
  journalEntry: text("journal_entry"), // User's feelings or notes for the day
  metadata: text("metadata", { mode: "json" }), // Stores EXIF and other metadata
  contentTags: text("content_tags", { mode: "json" }).$type<string[] | null>(), // Tags from image recognition
  indexed: integer("indexed", { mode: "boolean" }).default(false), // Whether the photo has been analyzed
  rotation: integer("rotation").default(0), // Manual rotation override: 0 | 90 | 180 | 270
});

export const insertPhotoSchema = createInsertSchema(photos, {
  createdAt: z.coerce.date(),
  contentTags: z.string().array().nullable().optional(),
}).omit({ id: true });

// Folders to scan
export const folders = sqliteTable("folders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"), // User provided description or "trace"
  displayPath: text("display_path"), // Original user-provided path for UI display
  lastScanned: integer("last_scanned", { mode: "timestamp" }),
  active: integer("active", { mode: "boolean" }).default(true),
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  lastScanned: true,
});

// Albums generated from search
export const albums = sqliteTable("albums", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"), // User provided description or "trace"
  searchTerms: text("search_terms", { mode: "json" }).$type<string[] | null>(),
  dateRangeStart: integer("date_range_start", { mode: "timestamp" }),
  dateRangeEnd: integer("date_range_end", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  coverPhotoId: integer("cover_photo_id"),
});

export const insertAlbumSchema = createInsertSchema(albums, {
  createdAt: z.coerce.date(),
  dateRangeStart: z.coerce.date().nullable().optional(),
  dateRangeEnd: z.coerce.date().nullable().optional(),
  searchTerms: z.string().array().nullable().optional(),
}).omit({ id: true });

// Junction table for photos in albums
export const albumPhotos = sqliteTable("album_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  albumId: integer("album_id").notNull(),
  photoId: integer("photo_id").notNull(),
}, (table) => [
  uniqueIndex("idx_album_photos_unique_pair").on(table.albumId, table.photoId),
]);

export const insertAlbumPhotoSchema = createInsertSchema(albumPhotos).omit({
  id: true,
});

// Journal entries
export const journalEntries = sqliteTable("journal_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: integer("date", { mode: "timestamp" }).notNull(),
  content: text("content").notNull(), // The journal text
  mood: text("mood"), // Optional mood indicator
  photoId: integer("photo_id"), // Optional associated photo
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries, {
  date: z.coerce.date(),
  createdAt: z.coerce.date(),
}).omit({ id: true });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export type Album = typeof albums.$inferSelect;
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;

export type AlbumWithPreview = Album & {
  previewPhotoIds: number[];
  photoCount: number;
};

export type AlbumPhoto = typeof albumPhotos.$inferSelect;
export type InsertAlbumPhoto = z.infer<typeof insertAlbumPhotoSchema>;

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
