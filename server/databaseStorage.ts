import { db } from "./db";
import {
  users,
  photos,
  folders,
  albums,
  albumPhotos,
  journalEntries,
  type User,
  type InsertUser,
  type Photo,
  type InsertPhoto,
  type Folder,
  type InsertFolder,
  type Album,
  type AlbumWithPreview,
  type InsertAlbum,
  type AlbumPhoto,
  type InsertAlbumPhoto,
  type JournalEntry,
  type InsertJournalEntry
} from "@shared/schema";
import { eq, and, between, like, or, desc, sql, inArray, isNull, isNotNull, count } from "drizzle-orm";
import { IStorage, RecentPlace } from "./storage";

// Memory-date semantics:
//   takenAt   = when the memory likely happened (EXIF DateTimeOriginal / CreateDate)
//   createdAt = when Trace imported or discovered the file (filesystem birthtime / now)
// COALESCE preserves legacy rows and URL-imported photos that carry no EXIF date.
const MEMORY_DATE = sql`COALESCE(${photos.takenAt}, ${photos.createdAt})`;
const memoryDateDesc = sql`${MEMORY_DATE} DESC`;

function memoryDateBetween(startDate: Date, endDate: Date) {
  return sql`${MEMORY_DATE} BETWEEN ${Math.floor(startDate.getTime() / 1000)} AND ${Math.floor(endDate.getTime() / 1000)}`;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Photo operations
  async getPhotos(limit = 50, offset = 0, startDate?: Date, endDate?: Date): Promise<Photo[]> {
    const dateCondition = (startDate && endDate) ? memoryDateBetween(startDate, endDate) : undefined;

    return await db
      .select()
      .from(photos)
      .where(dateCondition)
      .orderBy(memoryDateDesc)
      .limit(limit)
      .offset(offset);
  }

  async getFavoritePhotos(): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(eq(photos.favorite, true))
      .orderBy(memoryDateDesc);
  }

  async getPhotoById(id: number): Promise<Photo | undefined> {
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    return photo || undefined;
  }

  async getPhotosByDate(startDate: Date, endDate: Date): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(memoryDateBetween(startDate, endDate))
      .orderBy(memoryDateDesc);
  }

  async getPhotosByTags(tags: string[]): Promise<Photo[]> {
    if (tags.length === 0) return [];
    const conditions = tags.map(tag =>
      sql`exists (select 1 from json_each(${photos.contentTags}) where json_each.value = ${tag})`
    );
    return await db
      .select()
      .from(photos)
      .where(or(...conditions))
      .orderBy(desc(photos.createdAt));
  }

  async searchPhotos(terms: string[], startDate?: Date, endDate?: Date): Promise<Photo[]> {
    const whereConditions = [];

    if (startDate && endDate) {
      whereConditions.push(memoryDateBetween(startDate, endDate));
    }

    if (terms.length > 0) {
      const termConditions = terms.map(term => {
        const likeTerm = `%${term.toLowerCase()}%`;
        return or(
          like(sql`lower(${photos.fileName})`, likeTerm),
          like(sql`lower(${photos.location})`, likeTerm),
          sql`exists (select 1 from json_each(${photos.contentTags}) where lower(json_each.value) like ${likeTerm})`
        );
      });
      whereConditions.push(or(...termConditions));
    }

    return await db
      .select()
      .from(photos)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(memoryDateDesc);
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const [photo] = await db
      .insert(photos)
      .values(insertPhoto)
      .returning();
    return photo;
  }

  async updatePhoto(id: number, photoUpdate: Partial<InsertPhoto>): Promise<Photo | undefined> {
    const [updatedPhoto] = await db
      .update(photos)
      .set(photoUpdate)
      .where(eq(photos.id, id))
      .returning();
    return updatedPhoto || undefined;
  }

  async toggleFavorite(id: number): Promise<Photo | undefined> {
    // Get the current photo to toggle the favorite status
    const photo = await this.getPhotoById(id);
    if (!photo) return undefined;

    const [updatedPhoto] = await db
      .update(photos)
      .set({ favorite: !photo.favorite })
      .where(eq(photos.id, id))
      .returning();
    
    return updatedPhoto || undefined;
  }

  async deletePhoto(id: number): Promise<boolean> {
    // First delete any album associations
    await db
      .delete(albumPhotos)
      .where(eq(albumPhotos.photoId, id));

    // Then delete the photo and check a row was actually removed
    const deleted = await db
      .delete(photos)
      .where(eq(photos.id, id))
      .returning({ id: photos.id });

    return deleted.length > 0;
  }

  async getExistingFilePaths(paths: string[]): Promise<Set<string>> {
    if (paths.length === 0) return new Set();
    const rows = await db
      .select({ filePath: photos.filePath })
      .from(photos)
      .where(inArray(photos.filePath, paths));
    return new Set(rows.map((r) => r.filePath));
  }

  async getPlacedPhotos(): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(isNotNull(photos.coordinates))
      .orderBy(desc(photos.createdAt));
  }

  async getUnplacedPhotos(): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(isNull(photos.coordinates))
      .orderBy(desc(photos.createdAt));
  }

  async getPhotosByFolder(folderId: number): Promise<Photo[]> {
    const folder = await this.getFolderById(folderId);
    if (!folder) return [];
    const prefix = (folder.path.endsWith('/') ? folder.path : folder.path + '/') + '%';
    return await db
      .select()
      .from(photos)
      .where(sql`${photos.filePath} LIKE ${prefix}`)
      .orderBy(memoryDateDesc);
  }

  async getRecentPlaces(): Promise<RecentPlace[]> {
    const rows = await db
      .select({ location: photos.location, coordinates: photos.coordinates, createdAt: photos.createdAt })
      .from(photos)
      .where(and(isNotNull(photos.location), isNotNull(photos.coordinates)))
      .orderBy(desc(photos.createdAt));
    // Group by name; first occurrence per name is already the most recent (ORDER BY createdAt DESC)
    const nameMap = new Map<string, { lat: number; lng: number; count: number }>();
    for (const row of rows) {
      if (!row.location || !row.coordinates) continue;
      const coords = row.coordinates as { lat: number; lng: number };
      const existing = nameMap.get(row.location);
      if (!existing) {
        nameMap.set(row.location, { lat: coords.lat, lng: coords.lng, count: 1 });
      } else {
        existing.count++;
      }
    }
    return Array.from(nameMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, { lat, lng }]) => ({ name, lat, lng }));
  }

  // Folder operations
  async getFolders(): Promise<Folder[]> {
    return await db
      .select()
      .from(folders);
  }

  async getFolderById(id: number): Promise<Folder | undefined> {
    const [folder] = await db
      .select()
      .from(folders)
      .where(eq(folders.id, id));
    
    return folder || undefined;
  }

  async addFolder(insertFolder: InsertFolder): Promise<Folder> {
    const [folder] = await db
      .insert(folders)
      .values(insertFolder)
      .returning();
    
    return folder;
  }

  async updateFolder(id: number, folderUpdate: Partial<InsertFolder>): Promise<Folder | undefined> {
    const [updatedFolder] = await db
      .update(folders)
      .set(folderUpdate)
      .where(eq(folders.id, id))
      .returning();
    
    return updatedFolder || undefined;
  }

  async updateFolderScanTime(id: number, time: Date): Promise<Folder | undefined> {
    const [updatedFolder] = await db
      .update(folders)
      .set({ lastScanned: time })
      .where(eq(folders.id, id))
      .returning();
    
    return updatedFolder || undefined;
  }

  async deleteFolder(id: number): Promise<boolean> {
    const deleted = await db
      .delete(folders)
      .where(eq(folders.id, id))
      .returning({ id: folders.id });

    return deleted.length > 0;
  }

  // Album operations
  async getAlbums(): Promise<AlbumWithPreview[]> {
    const allAlbums = await db
      .select()
      .from(albums)
      .orderBy(desc(albums.createdAt));

    if (allAlbums.length === 0) return [];

    const rows = await db
      .select({ albumId: albumPhotos.albumId, photoId: albumPhotos.photoId })
      .from(albumPhotos)
      .where(inArray(albumPhotos.albumId, allAlbums.map(a => a.id)));

    const photosByAlbum = new Map<number, number[]>();
    for (const row of rows) {
      if (!photosByAlbum.has(row.albumId)) photosByAlbum.set(row.albumId, []);
      photosByAlbum.get(row.albumId)!.push(row.photoId);
    }

    return allAlbums.map(album => {
      const photoIds = photosByAlbum.get(album.id) ?? [];
      return { ...album, previewPhotoIds: photoIds.slice(0, 4), photoCount: photoIds.length };
    });
  }

  async getAlbumById(id: number): Promise<Album | undefined> {
    const [album] = await db
      .select()
      .from(albums)
      .where(eq(albums.id, id));
    
    return album || undefined;
  }

  async getAlbumPhotos(albumId: number): Promise<Photo[]> {
    const photoIds = await db
      .select({ photoId: albumPhotos.photoId })
      .from(albumPhotos)
      .where(eq(albumPhotos.albumId, albumId));
    
    if (photoIds.length === 0) return [];

    return await db
      .select()
      .from(photos)
      .where(inArray(photos.id, photoIds.map(p => p.photoId)))
      .orderBy(memoryDateDesc);
  }

  async createAlbum(insertAlbum: InsertAlbum): Promise<Album> {
    const [album] = await db
      .insert(albums)
      .values(insertAlbum)
      .returning();
    
    return album;
  }

  async updateAlbum(id: number, albumUpdate: Partial<InsertAlbum>): Promise<Album | undefined> {
    const [updatedAlbum] = await db
      .update(albums)
      .set(albumUpdate)
      .where(eq(albums.id, id))
      .returning();
    
    return updatedAlbum || undefined;
  }

  async addPhotoToAlbum(albumId: number, photoId: number): Promise<AlbumPhoto> {
    const [albumPhoto] = await db
      .insert(albumPhotos)
      .values({ albumId, photoId })
      .onConflictDoNothing()
      .returning();

    if (!albumPhoto) {
      const [existing] = await db
        .select()
        .from(albumPhotos)
        .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)));
      return existing;
    }

    return albumPhoto;
  }

  async removePhotoFromAlbum(albumId: number, photoId: number): Promise<boolean> {
    const result = await db
      .delete(albumPhotos)
      .where(
        and(
          eq(albumPhotos.albumId, albumId),
          eq(albumPhotos.photoId, photoId)
        )
      );
    
    return !!result;
  }

  async deleteAlbum(id: number): Promise<boolean> {
    // First delete all photo associations
    await db
      .delete(albumPhotos)
      .where(eq(albumPhotos.albumId, id));

    // Then delete the album and check a row was actually removed
    const deleted = await db
      .delete(albums)
      .where(eq(albums.id, id))
      .returning({ id: albums.id });

    return deleted.length > 0;
  }

  // Journal operations
  async getJournalEntries(startDate?: Date, endDate?: Date): Promise<JournalEntry[]> {
    let baseQuery = db
      .select()
      .from(journalEntries)
      .orderBy(desc(journalEntries.date));
    
    if (startDate && endDate) {
      return await baseQuery.where(between(journalEntries.date, startDate, endDate));
    }
    
    return await baseQuery;
  }

  async getJournalEntryById(id: number): Promise<JournalEntry | undefined> {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, id));
    
    return entry || undefined;
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const [journalEntry] = await db
      .insert(journalEntries)
      .values(entry)
      .returning();
    
    return journalEntry;
  }

  async updateJournalEntry(id: number, entryUpdate: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const [updatedEntry] = await db
      .update(journalEntries)
      .set(entryUpdate)
      .where(eq(journalEntries.id, id))
      .returning();
    
    return updatedEntry || undefined;
  }

  async deleteJournalEntry(id: number): Promise<boolean> {
    const deleted = await db
      .delete(journalEntries)
      .where(eq(journalEntries.id, id))
      .returning({ id: journalEntries.id });

    return deleted.length > 0;
  }

  async getJournalEntriesByPhotoId(photoId: number): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.photoId, photoId))
      .orderBy(desc(journalEntries.date));
  }
}