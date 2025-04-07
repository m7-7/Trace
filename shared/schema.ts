import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users (keeping the original table)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Photos table to store metadata and paths
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // e.g., 'image/jpeg', 'video/mp4'
  fileSize: integer("file_size").notNull(),
  createdAt: timestamp("created_at").notNull(),
  width: integer("width"),
  height: integer("height"),
  favorite: boolean("favorite").default(false),
  location: text("location"),
  metadata: jsonb("metadata"), // Stores EXIF and other metadata
  contentTags: text("content_tags").array(), // Tags from image recognition
  indexed: boolean("indexed").default(false) // Whether the photo has been analyzed
});

export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
});

// Folders to scan
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  path: text("path").notNull().unique(),
  name: text("name").notNull(),
  lastScanned: timestamp("last_scanned"),
  active: boolean("active").default(true)
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  lastScanned: true
});

// Albums generated from search
export const albums = pgTable("albums", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  searchTerms: text("search_terms").array(),
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  createdAt: timestamp("created_at").notNull(),
  coverPhotoId: integer("cover_photo_id")
});

export const insertAlbumSchema = createInsertSchema(albums).omit({
  id: true
});

// Junction table for photos in albums
export const albumPhotos = pgTable("album_photos", {
  id: serial("id").primaryKey(),
  albumId: integer("album_id").notNull(),
  photoId: integer("photo_id").notNull()
});

export const insertAlbumPhotoSchema = createInsertSchema(albumPhotos).omit({
  id: true
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export type Album = typeof albums.$inferSelect;
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;

export type AlbumPhoto = typeof albumPhotos.$inferSelect;
export type InsertAlbumPhoto = z.infer<typeof insertAlbumPhotoSchema>;
