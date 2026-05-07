import {
  users,
  type User,
  type InsertUser,
  photos,
  type Photo,
  type InsertPhoto,
  folders,
  type Folder,
  type InsertFolder,
  albums,
  type Album,
  type InsertAlbum,
  albumPhotos,
  type AlbumPhoto,
  type InsertAlbumPhoto,
  journalEntries,
  type JournalEntry,
  type InsertJournalEntry,
} from "@shared/schema";

// Storage interface for CRUD operations
export interface IStorage {
  // User operations (keeping the original methods)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Photo operations
  getPhotos(limit?: number, offset?: number): Promise<Photo[]>;
  getFavoritePhotos(): Promise<Photo[]>;
  getPhotoById(id: number): Promise<Photo | undefined>;
  getPhotosByDate(startDate: Date, endDate: Date): Promise<Photo[]>;
  getPhotosByTags(tags: string[]): Promise<Photo[]>;
  searchPhotos(
    terms: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<Photo[]>;
  createPhoto(photo: InsertPhoto): Promise<Photo>;
  updatePhoto(
    id: number,
    photo: Partial<InsertPhoto>,
  ): Promise<Photo | undefined>;
  toggleFavorite(id: number): Promise<Photo | undefined>;
  deletePhoto(id: number): Promise<boolean>;
  getExistingFilePaths(paths: string[]): Promise<Set<string>>;

  // Folder operations
  getFolders(): Promise<Folder[]>;
  getFolderById(id: number): Promise<Folder | undefined>;
  addFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(
    id: number,
    folder: Partial<InsertFolder>,
  ): Promise<Folder | undefined>;
  updateFolderScanTime(id: number, time: Date): Promise<Folder | undefined>;
  deleteFolder(id: number): Promise<boolean>;

  // Album operations
  getAlbums(): Promise<Album[]>;
  getAlbumById(id: number): Promise<Album | undefined>;
  getAlbumPhotos(albumId: number): Promise<Photo[]>;
  createAlbum(album: InsertAlbum): Promise<Album>;
  updateAlbum(
    id: number,
    album: Partial<InsertAlbum>,
  ): Promise<Album | undefined>;
  addPhotoToAlbum(albumId: number, photoId: number): Promise<AlbumPhoto>;
  removePhotoFromAlbum(albumId: number, photoId: number): Promise<boolean>;
  deleteAlbum(id: number): Promise<boolean>;

  // Journal operations
  getJournalEntries(startDate?: Date, endDate?: Date): Promise<JournalEntry[]>;
  getJournalEntryById(id: number): Promise<JournalEntry | undefined>;
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(
    id: number,
    entry: Partial<InsertJournalEntry>,
  ): Promise<JournalEntry | undefined>;
  deleteJournalEntry(id: number): Promise<boolean>;
  getJournalEntriesByPhotoId(photoId: number): Promise<JournalEntry[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private photos: Map<number, Photo>;
  private folders: Map<number, Folder>;
  private albums: Map<number, Album>;
  private albumPhotos: Map<number, AlbumPhoto>;
  private journalEntries: Map<number, JournalEntry>;

  private userCurrentId: number;
  private photoCurrentId: number;
  private folderCurrentId: number;
  private albumCurrentId: number;
  private albumPhotoCurrentId: number;
  private journalEntryCurrentId: number;

  constructor() {
    this.users = new Map();
    this.photos = new Map();
    this.folders = new Map();
    this.albums = new Map();
    this.albumPhotos = new Map();
    this.journalEntries = new Map();

    this.userCurrentId = 1;
    this.photoCurrentId = 1;
    this.folderCurrentId = 1;
    this.albumCurrentId = 1;
    this.albumPhotoCurrentId = 1;
    this.journalEntryCurrentId = 1;
  }

  // User methods (keeping the original implementations)
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Photo methods
  async getPhotos(limit = 50, offset = 0): Promise<Photo[]> {
    const allPhotos = Array.from(this.photos.values());
    return allPhotos
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  async getFavoritePhotos(): Promise<Photo[]> {
    return Array.from(this.photos.values())
      .filter((photo) => photo.favorite)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPhotoById(id: number): Promise<Photo | undefined> {
    return this.photos.get(id);
  }

  async getPhotosByDate(startDate: Date, endDate: Date): Promise<Photo[]> {
    return Array.from(this.photos.values()).filter(
      (photo) => photo.createdAt >= startDate && photo.createdAt <= endDate,
    );
  }

  async getPhotosByTags(tags: string[]): Promise<Photo[]> {
    return Array.from(this.photos.values()).filter((photo) =>
      tags.some((tag) => photo.contentTags && photo.contentTags.includes(tag)),
    );
  }

  async searchPhotos(
    terms: string[],
    startDate?: Date,
    endDate?: Date,
  ): Promise<Photo[]> {
    return Array.from(this.photos.values()).filter((photo) => {
      // Check date range if provided
      const dateMatch =
        !startDate ||
        !endDate ||
        (photo.createdAt >= startDate && photo.createdAt <= endDate);

      if (!dateMatch) return false;

      // Check for matching terms in tags
      if (terms.length === 0) return true;

      return terms.some((term) => {
        // Check against filename
        if (photo.fileName.toLowerCase().includes(term.toLowerCase()))
          return true;

        // Check against location
        if (
          photo.location &&
          photo.location.toLowerCase().includes(term.toLowerCase())
        )
          return true;

        // Check against content tags
        return (
          photo.contentTags &&
          photo.contentTags.some((tag) =>
            tag.toLowerCase().includes(term.toLowerCase()),
          )
        );
      });
    });
  }

  async createPhoto(insertPhoto: InsertPhoto): Promise<Photo> {
    const id = this.photoCurrentId++;
    // Ensure all required fields have non-undefined values
    const photo: Photo = {
      ...insertPhoto,
      id,
      width: insertPhoto.width || null,
      height: insertPhoto.height || null,
      favorite: insertPhoto.favorite || false,
      description: insertPhoto.description || null,
      location: insertPhoto.location || null,
      contentTags: insertPhoto.contentTags || [],
      coordinates: insertPhoto.coordinates || null,
      metadata: insertPhoto.metadata || null,
      journalEntry: insertPhoto.journalEntry || null,
      indexed: insertPhoto.indexed || false,
    };
    this.photos.set(id, photo);
    return photo;
  }

  async updatePhoto(
    id: number,
    photoUpdate: Partial<InsertPhoto>,
  ): Promise<Photo | undefined> {
    const photo = this.photos.get(id);
    if (!photo) return undefined;

    const updatedPhoto = { ...photo, ...photoUpdate };
    this.photos.set(id, updatedPhoto);
    return updatedPhoto;
  }

  async toggleFavorite(id: number): Promise<Photo | undefined> {
    const photo = this.photos.get(id);
    if (!photo) return undefined;

    photo.favorite = !photo.favorite;
    this.photos.set(id, photo);
    return photo;
  }

  async deletePhoto(id: number): Promise<boolean> {
    // Remove photo from all albums
    for (const albumPhoto of Array.from(this.albumPhotos.values())) {
      if (albumPhoto.photoId === id) {
        this.albumPhotos.delete(albumPhoto.id);
      }
    }

    return this.photos.delete(id);
  }

  async getExistingFilePaths(paths: string[]): Promise<Set<string>> {
    if (paths.length === 0) return new Set();
    const pathSet = new Set(paths);
    return new Set(
      Array.from(this.photos.values())
        .map((p) => p.filePath)
        .filter((fp) => pathSet.has(fp)),
    );
  }

  // Folder methods
  async getFolders(): Promise<Folder[]> {
    return Array.from(this.folders.values());
  }

  async getFolderById(id: number): Promise<Folder | undefined> {
    return this.folders.get(id);
  }

  async addFolder(insertFolder: InsertFolder): Promise<Folder> {
    const id = this.folderCurrentId++;
    const folder: Folder = {
      id,
      path: insertFolder.path,
      name: insertFolder.name,
      displayPath: insertFolder.displayPath ?? null,
      lastScanned: null,
      description: insertFolder.description ?? null,
      active: insertFolder.active ?? null,
    };
    this.folders.set(id, folder);
    return folder;
  }

  async updateFolder(
    id: number,
    folderUpdate: Partial<InsertFolder>,
  ): Promise<Folder | undefined> {
    const folder = this.folders.get(id);
    if (!folder) return undefined;

    const updatedFolder = { ...folder, ...folderUpdate };
    this.folders.set(id, updatedFolder);
    return updatedFolder;
  }

  async updateFolderScanTime(
    id: number,
    time: Date,
  ): Promise<Folder | undefined> {
    const folder = this.folders.get(id);
    if (!folder) return undefined;

    folder.lastScanned = time;
    this.folders.set(id, folder);
    return folder;
  }

  async deleteFolder(id: number): Promise<boolean> {
    return this.folders.delete(id);
  }

  // Album methods
  async getAlbums(): Promise<Album[]> {
    return Array.from(this.albums.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async getAlbumById(id: number): Promise<Album | undefined> {
    return this.albums.get(id);
  }

  async getAlbumPhotos(albumId: number): Promise<Photo[]> {
    const photoIds = Array.from(this.albumPhotos.values())
      .filter((ap) => ap.albumId === albumId)
      .map((ap) => ap.photoId);

    return photoIds.map((id) => this.photos.get(id)!).filter(Boolean);
  }

  async createAlbum(insertAlbum: InsertAlbum): Promise<Album> {
    const id = this.albumCurrentId++;
    const album: Album = {
      ...insertAlbum,
      id,
      description: insertAlbum.description || null,
      searchTerms: insertAlbum.searchTerms || null,
      dateRangeStart: insertAlbum.dateRangeStart || null,
      dateRangeEnd: insertAlbum.dateRangeEnd || null,
      coverPhotoId: insertAlbum.coverPhotoId || null,
    };
    this.albums.set(id, album);
    return album;
  }

  async updateAlbum(
    id: number,
    albumUpdate: Partial<InsertAlbum>,
  ): Promise<Album | undefined> {
    const album = this.albums.get(id);
    if (!album) return undefined;

    const updatedAlbum = { ...album, ...albumUpdate };
    this.albums.set(id, updatedAlbum);
    return updatedAlbum;
  }

  async addPhotoToAlbum(albumId: number, photoId: number): Promise<AlbumPhoto> {
    const id = this.albumPhotoCurrentId++;
    const albumPhoto: AlbumPhoto = { id, albumId, photoId };
    this.albumPhotos.set(id, albumPhoto);
    return albumPhoto;
  }

  async removePhotoFromAlbum(
    albumId: number,
    photoId: number,
  ): Promise<boolean> {
    const albumPhoto = Array.from(this.albumPhotos.values()).find(
      (ap) => ap.albumId === albumId && ap.photoId === photoId,
    );

    if (!albumPhoto) return false;
    return this.albumPhotos.delete(albumPhoto.id);
  }

  async deleteAlbum(id: number): Promise<boolean> {
    // Delete all album photos associations
    for (const albumPhoto of Array.from(this.albumPhotos.values())) {
      if (albumPhoto.albumId === id) {
        this.albumPhotos.delete(albumPhoto.id);
      }
    }

    return this.albums.delete(id);
  }

  // Journal methods
  async getJournalEntries(
    startDate?: Date,
    endDate?: Date,
  ): Promise<JournalEntry[]> {
    let entries = Array.from(this.journalEntries.values()).sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    if (startDate && endDate) {
      entries = entries.filter(
        (entry) => entry.date >= startDate && entry.date <= endDate,
      );
    }

    return entries;
  }

  async getJournalEntryById(id: number): Promise<JournalEntry | undefined> {
    return this.journalEntries.get(id);
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const id = this.journalEntryCurrentId++;
    const journalEntry: JournalEntry = {
      ...entry,
      id,
      photoId: entry.photoId || null,
      mood: entry.mood || null,
    };
    this.journalEntries.set(id, journalEntry);
    return journalEntry;
  }

  async updateJournalEntry(
    id: number,
    entryUpdate: Partial<InsertJournalEntry>,
  ): Promise<JournalEntry | undefined> {
    const entry = this.journalEntries.get(id);
    if (!entry) return undefined;

    const updatedEntry = { ...entry, ...entryUpdate };
    this.journalEntries.set(id, updatedEntry);
    return updatedEntry;
  }

  async deleteJournalEntry(id: number): Promise<boolean> {
    return this.journalEntries.delete(id);
  }

  async getJournalEntriesByPhotoId(photoId: number): Promise<JournalEntry[]> {
    return Array.from(this.journalEntries.values())
      .filter((entry) => entry.photoId === photoId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}

// Import the DatabaseStorage class
import { DatabaseStorage } from "./databaseStorage";

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
