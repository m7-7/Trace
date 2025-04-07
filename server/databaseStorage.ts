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
  type InsertAlbum, 
  type AlbumPhoto, 
  type InsertAlbumPhoto, 
  type JournalEntry, 
  type InsertJournalEntry
} from "@shared/schema";
import { eq, and, between, like, or, desc, sql, inArray } from "drizzle-orm";
import { IStorage } from "./storage";

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
  async getPhotos(limit = 50, offset = 0): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getPhotoById(id: number): Promise<Photo | undefined> {
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    return photo || undefined;
  }

  async getPhotosByDate(startDate: Date, endDate: Date): Promise<Photo[]> {
    return await db
      .select()
      .from(photos)
      .where(between(photos.createdAt, startDate, endDate))
      .orderBy(desc(photos.createdAt));
  }

  async getPhotosByTags(tags: string[]): Promise<Photo[]> {
    // This is a bit tricky with SQL, need to check for array overlap
    return await db
      .select()
      .from(photos)
      .where(
        sql`${photos.contentTags} && ${tags}`
      )
      .orderBy(desc(photos.createdAt));
  }

  async searchPhotos(terms: string[], startDate?: Date, endDate?: Date): Promise<Photo[]> {
    let baseQuery = db.select().from(photos);
    let whereConditions = [];

    // Add date range filter if provided
    if (startDate && endDate) {
      whereConditions.push(between(photos.createdAt, startDate, endDate));
    }

    // Add search terms filters if provided
    if (terms.length > 0) {
      const termConditions = terms.map(term => {
        const likeTerm = `%${term.toLowerCase()}%`;
        return or(
          like(sql`lower(${photos.fileName})`, likeTerm),
          like(sql`lower(${photos.location})`, likeTerm),
          sql`exists (select 1 from unnest(${photos.contentTags}) as tag where lower(tag) like ${likeTerm})`
        );
      });
      
      whereConditions.push(or(...termConditions));
    }

    // Apply filters and order by
    if (whereConditions.length > 0) {
      baseQuery = baseQuery.where(and(...whereConditions));
    }

    return await baseQuery.orderBy(desc(photos.createdAt));
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

    // Then delete the photo
    const result = await db
      .delete(photos)
      .where(eq(photos.id, id));
    
    return !!result;
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
    const result = await db
      .delete(folders)
      .where(eq(folders.id, id));
    
    return !!result;
  }

  // Album operations
  async getAlbums(): Promise<Album[]> {
    return await db
      .select()
      .from(albums)
      .orderBy(desc(albums.createdAt));
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
      .orderBy(desc(photos.createdAt));
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
      .returning();
    
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
    
    // Then delete the album
    const result = await db
      .delete(albums)
      .where(eq(albums.id, id));
    
    return !!result;
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
    const result = await db
      .delete(journalEntries)
      .where(eq(journalEntries.id, id));
    
    return !!result;
  }

  async getJournalEntriesByPhotoId(photoId: number): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.photoId, photoId))
      .orderBy(desc(journalEntries.date));
  }
}