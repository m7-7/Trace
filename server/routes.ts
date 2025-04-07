import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import { analyzeImage, initializeModel } from "./imageRecognition";
import { 
  insertPhotoSchema, 
  insertFolderSchema, 
  insertAlbumSchema,
  insertJournalEntrySchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// Helper to handle file metadata extraction
async function getFileMetadata(filePath: string) {
  const stats = await fs.promises.stat(filePath);
  const fileName = path.basename(filePath);
  const fileType = path.extname(filePath).toLowerCase();
  
  // Only process images and videos
  const supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const supportedVideoTypes = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
  
  const isImage = supportedImageTypes.includes(fileType);
  const isVideo = supportedVideoTypes.includes(fileType);
  
  if (!isImage && !isVideo) {
    return null;
  }
  
  return {
    filePath,
    fileName,
    fileType: isImage ? 'image' : 'video',
    fileSize: stats.size,
    createdAt: stats.birthtime || stats.mtime, // Use creation time or modification time
  };
}

// Scan directory recursively
async function scanDirectory(directoryPath: string, recursive = true) {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];
  
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    
    if (entry.isDirectory() && recursive) {
      const subFiles = await scanDirectory(fullPath, recursive);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  
  return files;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize the TensorFlow model
  initializeModel().catch(console.error);
  
  // API routes
  // All routes are prefixed with /api
  
  // Get all photos with pagination
  app.get('/api/photos', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const photos = await storage.getPhotos(limit, offset);
      res.json(photos);
    } catch (error) {
      console.error('Error fetching photos:', error);
      res.status(500).json({ message: 'Failed to fetch photos' });
    }
  });
  
  // Get photo by ID
  app.get('/api/photos/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const photo = await storage.getPhotoById(id);
      
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }
      
      res.json(photo);
    } catch (error) {
      console.error('Error fetching photo:', error);
      res.status(500).json({ message: 'Failed to fetch photo' });
    }
  });
  
  // Toggle favorite status
  app.put('/api/photos/:id/favorite', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const photo = await storage.toggleFavorite(id);
      
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }
      
      res.json(photo);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      res.status(500).json({ message: 'Failed to toggle favorite' });
    }
  });
  
  // Get favorite photos
  app.get('/api/photos/favorites', async (req: Request, res: Response) => {
    try {
      const allPhotos = await storage.getPhotos(1000, 0); // Retrieve with a large limit
      const favorites = allPhotos.filter(photo => photo.favorite);
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ message: 'Failed to fetch favorites' });
    }
  });
  
  // Search photos
  app.get('/api/photos/search', async (req: Request, res: Response) => {
    try {
      const searchQuery = req.query.q as string || '';
      const terms = searchQuery.split(' ').filter(Boolean);
      
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }
      
      const photos = await storage.searchPhotos(terms, startDate, endDate);
      res.json(photos);
    } catch (error) {
      console.error('Error searching photos:', error);
      res.status(500).json({ message: 'Failed to search photos' });
    }
  });
  
  // Get all folders
  app.get('/api/folders', async (req: Request, res: Response) => {
    try {
      const folders = await storage.getFolders();
      res.json(folders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      res.status(500).json({ message: 'Failed to fetch folders' });
    }
  });
  
  // Add a new folder to scan
  app.post('/api/folders', async (req: Request, res: Response) => {
    try {
      const folderData = insertFolderSchema.parse(req.body);
      
      // Check if folder exists
      try {
        await fs.promises.access(folderData.path, fs.constants.R_OK);
      } catch (error) {
        return res.status(400).json({ message: 'Folder path is invalid or inaccessible' });
      }
      
      const folder = await storage.addFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const readableError = fromZodError(error);
        return res.status(400).json({ message: 'Invalid folder data', errors: readableError.message });
      }
      
      console.error('Error adding folder:', error);
      res.status(500).json({ message: 'Failed to add folder' });
    }
  });
  
  // Delete a folder
  app.delete('/api/folders/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteFolder(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).json({ message: 'Failed to delete folder' });
    }
  });
  
  // Scan a folder for photos and videos
  app.post('/api/folders/:id/scan', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const folder = await storage.getAlbumById(id);
      
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      
      // Start scanning process
      res.status(202).json({ message: 'Scanning started', folderId: id });
      
      // Get the folder information
      const folders = await storage.getFolders();
      const folderToScan = folders.find(f => f.id === id);
      
      if (!folderToScan) {
        console.error('Folder not found in subsequent scan');
        return;
      }
      
      // Scan the directory for files
      const files = await scanDirectory(folderToScan.path, true);
      let processedCount = 0;
      let successCount = 0;
      
      // Process each file
      for (const filePath of files) {
        try {
          const metadata = await getFileMetadata(filePath);
          if (!metadata) continue; // Skip unsupported file types
          
          // Check if photo already exists
          const existingPhotos = await storage.getPhotos(1000, 0);
          const photoExists = existingPhotos.some(p => p.filePath === filePath);
          
          if (photoExists) {
            processedCount++;
            continue;
          }
          
          // Extract content tags for images
          let contentTags: string[] = [];
          if (metadata.fileType === 'image') {
            contentTags = await analyzeImage(filePath);
          }
          
          // Create photo record
          const photoData = {
            ...metadata,
            width: 0, // These would be extracted from the actual image
            height: 0,
            favorite: false,
            location: null,
            metadata: {},
            contentTags,
            indexed: true
          };
          
          await storage.createPhoto(photoData);
          successCount++;
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error);
        }
        
        processedCount++;
      }
      
      // Update folder scan time
      await storage.updateFolderScanTime(id, new Date());
      
      console.log(`Scan completed: Processed ${processedCount} files, added ${successCount} new photos/videos`);
    } catch (error) {
      console.error('Error scanning folder:', error);
    }
  });
  
  // Get all albums
  app.get('/api/albums', async (req: Request, res: Response) => {
    try {
      const albums = await storage.getAlbums();
      res.json(albums);
    } catch (error) {
      console.error('Error fetching albums:', error);
      res.status(500).json({ message: 'Failed to fetch albums' });
    }
  });
  
  // Get album by ID
  app.get('/api/albums/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const album = await storage.getAlbumById(id);
      
      if (!album) {
        return res.status(404).json({ message: 'Album not found' });
      }
      
      res.json(album);
    } catch (error) {
      console.error('Error fetching album:', error);
      res.status(500).json({ message: 'Failed to fetch album' });
    }
  });
  
  // Get photos in an album
  app.get('/api/albums/:id/photos', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const album = await storage.getAlbumById(id);
      
      if (!album) {
        return res.status(404).json({ message: 'Album not found' });
      }
      
      const photos = await storage.getAlbumPhotos(id);
      res.json(photos);
    } catch (error) {
      console.error('Error fetching album photos:', error);
      res.status(500).json({ message: 'Failed to fetch album photos' });
    }
  });
  
  // Create a new album
  app.post('/api/albums', async (req: Request, res: Response) => {
    try {
      const albumData = insertAlbumSchema.parse({
        ...req.body,
        createdAt: new Date()
      });
      
      // Create the album
      const album = await storage.createAlbum(albumData);
      
      // Find matching photos based on search terms and date range
      const matchingPhotos = await storage.searchPhotos(
        albumData.searchTerms || [],
        albumData.dateRangeStart || undefined,
        albumData.dateRangeEnd || undefined
      );
      
      // Add photos to the album
      for (const photo of matchingPhotos) {
        await storage.addPhotoToAlbum(album.id, photo.id);
      }
      
      // Set cover photo if we have matching photos
      if (matchingPhotos.length > 0 && !album.coverPhotoId) {
        // This is a placeholder - we should update the Album to have a coverPhotoId
        console.log(`Album ${album.id} could use cover photo ${matchingPhotos[0].id}`);
      }
      
      res.status(201).json({
        ...album,
        photoCount: matchingPhotos.length
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const readableError = fromZodError(error);
        return res.status(400).json({ message: 'Invalid album data', errors: readableError.message });
      }
      
      console.error('Error creating album:', error);
      res.status(500).json({ message: 'Failed to create album' });
    }
  });
  
  // Delete an album
  app.delete('/api/albums/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAlbum(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Album not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting album:', error);
      res.status(500).json({ message: 'Failed to delete album' });
    }
  });
  
  // Journal entries endpoints
  // Get all journal entries or filtered by date range
  app.get('/api/journal', async (req: Request, res: Response) => {
    try {
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }
      
      const entries = await storage.getJournalEntries(startDate, endDate);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching journal entries:', error);
      res.status(500).json({ message: 'Failed to fetch journal entries' });
    }
  });
  
  // Get journal entry by ID
  app.get('/api/journal/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getJournalEntryById(id);
      
      if (!entry) {
        return res.status(404).json({ message: 'Journal entry not found' });
      }
      
      res.json(entry);
    } catch (error) {
      console.error('Error fetching journal entry:', error);
      res.status(500).json({ message: 'Failed to fetch journal entry' });
    }
  });
  
  // Get journal entries for a specific photo
  app.get('/api/photos/:id/journal', async (req: Request, res: Response) => {
    try {
      const photoId = parseInt(req.params.id);
      const photo = await storage.getPhotoById(photoId);
      
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }
      
      const entries = await storage.getJournalEntriesByPhotoId(photoId);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching photo journal entries:', error);
      res.status(500).json({ message: 'Failed to fetch photo journal entries' });
    }
  });
  
  // Create a new journal entry
  app.post('/api/journal', async (req: Request, res: Response) => {
    try {
      const entryData = insertJournalEntrySchema.parse({
        ...req.body,
        createdAt: new Date()
      });
      
      const entry = await storage.createJournalEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const readableError = fromZodError(error);
        return res.status(400).json({ message: 'Invalid journal entry data', errors: readableError.message });
      }
      
      console.error('Error creating journal entry:', error);
      res.status(500).json({ message: 'Failed to create journal entry' });
    }
  });
  
  // Update a journal entry
  app.put('/api/journal/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getJournalEntryById(id);
      
      if (!entry) {
        return res.status(404).json({ message: 'Journal entry not found' });
      }
      
      const entryData = req.body;
      const updatedEntry = await storage.updateJournalEntry(id, entryData);
      res.json(updatedEntry);
    } catch (error) {
      console.error('Error updating journal entry:', error);
      res.status(500).json({ message: 'Failed to update journal entry' });
    }
  });
  
  // Delete a journal entry
  app.delete('/api/journal/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteJournalEntry(id);
      
      if (!success) {
        return res.status(404).json({ message: 'Journal entry not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      res.status(500).json({ message: 'Failed to delete journal entry' });
    }
  });

  // Add description to photo (a "trace")
  app.put('/api/photos/:id/description', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const photo = await storage.getPhotoById(id);
      
      if (!photo) {
        return res.status(404).json({ message: 'Photo not found' });
      }
      
      const { description } = req.body;
      
      if (typeof description !== 'string') {
        return res.status(400).json({ message: 'Description must be a string' });
      }
      
      const updatedPhoto = await storage.updatePhoto(id, { description });
      res.json(updatedPhoto);
    } catch (error) {
      console.error('Error updating photo description:', error);
      res.status(500).json({ message: 'Failed to update photo description' });
    }
  });
  
  // Add description to folder (a "trace")
  app.put('/api/folders/:id/description', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const folder = await storage.getFolderById(id);
      
      if (!folder) {
        return res.status(404).json({ message: 'Folder not found' });
      }
      
      const { description } = req.body;
      
      if (typeof description !== 'string') {
        return res.status(400).json({ message: 'Description must be a string' });
      }
      
      // We need to add this method to the storage interface
      const updatedFolder = await storage.updateFolder(id, { description });
      res.json(updatedFolder);
    } catch (error) {
      console.error('Error updating folder description:', error);
      res.status(500).json({ message: 'Failed to update folder description' });
    }
  });
  
  // Add description to album (a "trace")
  app.put('/api/albums/:id/description', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const album = await storage.getAlbumById(id);
      
      if (!album) {
        return res.status(404).json({ message: 'Album not found' });
      }
      
      const { description } = req.body;
      
      if (typeof description !== 'string') {
        return res.status(400).json({ message: 'Description must be a string' });
      }
      
      // We need to add this method to the storage interface
      const updatedAlbum = await storage.updateAlbum(id, { description });
      res.json(updatedAlbum);
    } catch (error) {
      console.error('Error updating album description:', error);
      res.status(500).json({ message: 'Failed to update album description' });
    }
  });
  
  // Serve static photos and videos
  app.get('/api/media/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const photo = await storage.getPhotoById(id);
      
      if (!photo) {
        return res.status(404).json({ message: 'Media not found' });
      }
      
      // Check if file exists
      try {
        await fs.promises.access(photo.filePath, fs.constants.R_OK);
      } catch (error) {
        return res.status(404).json({ message: 'Media file not found' });
      }
      
      // Determine MIME type
      let contentType = 'application/octet-stream';
      if (photo.fileType === 'image') {
        const ext = path.extname(photo.filePath).toLowerCase();
        switch (ext) {
          case '.jpg':
          case '.jpeg':
            contentType = 'image/jpeg';
            break;
          case '.png':
            contentType = 'image/png';
            break;
          case '.gif':
            contentType = 'image/gif';
            break;
          case '.webp':
            contentType = 'image/webp';
            break;
          case '.bmp':
            contentType = 'image/bmp';
            break;
        }
      } else if (photo.fileType === 'video') {
        const ext = path.extname(photo.filePath).toLowerCase();
        switch (ext) {
          case '.mp4':
            contentType = 'video/mp4';
            break;
          case '.mov':
            contentType = 'video/quicktime';
            break;
          case '.avi':
            contentType = 'video/x-msvideo';
            break;
          case '.webm':
            contentType = 'video/webm';
            break;
        }
      }
      
      res.setHeader('Content-Type', contentType);
      fs.createReadStream(photo.filePath).pipe(res);
    } catch (error) {
      console.error('Error serving media:', error);
      res.status(500).json({ message: 'Failed to serve media' });
    }
  });

  return httpServer;
}
