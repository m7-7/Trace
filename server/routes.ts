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
  
  // Get favorite photos (must come before /:id to avoid being treated as an ID)
  app.get('/api/photos/favorites', async (req: Request, res: Response) => {
    try {
      const favorites = await storage.getFavoritePhotos();
      res.json(favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      res.status(500).json({ message: 'Failed to fetch favorites' });
    }
  });

  // Search photos (must come before /:id to avoid being treated as an ID)
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

  // Get photo by ID
  app.get('/api/photos/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }
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
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid photo ID' });
      }
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
      
      // In a browser environment, we can't really check access to arbitrary filesystem paths
      // So we'll create a simulated folder structure that works within our application's scope
      
      // Create uploads directory if it doesn't exist
      try {
        await fs.promises.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
        
        // Create a subdirectory with the folder name to simulate the real folder
        const folderName = path.basename(folderData.path);
        const simulatedPath = path.join(process.cwd(), 'uploads', folderName);
        await fs.promises.mkdir(simulatedPath, { recursive: true });
        
        // Keep the original user-provided path for display purposes
        // We'll use this for showing the folder path, but use simulatedPath for actual operations
        const originalPath = folderData.path;
        
        // Store the original path but work with the simulated path
        folderData.path = simulatedPath;
        folderData.displayPath = originalPath;
      } catch (error) {
        console.error('Error creating simulated folder:', error);
        // We'll continue anyway since we're just simulating folder access
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
      const folder = await storage.getFolderById(id);
      
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

      // Fetch all existing file paths once up-front to avoid an N+1 query inside the loop
      const existingPhotos = await storage.getPhotos(100000, 0);
      const existingPaths = new Set(existingPhotos.map(p => p.filePath));

      // Process each file
      for (const filePath of files) {
        try {
          const metadata = await getFileMetadata(filePath);
          if (!metadata) continue; // Skip unsupported file types
          
          // Check if photo already exists
          const photoExists = existingPaths.has(filePath);
          
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

  // Fetch file list from a public Google Drive folder
  app.post('/api/photos/fetch-from-drive', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: 'URL is required' });
      }

      // Extract folder ID from any Drive folder URL format
      const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (!folderMatch) {
        return res.status(400).json({ message: 'Invalid Google Drive folder URL. Make sure it contains /folders/ in the path.' });
      }
      const folderId = folderMatch[1];

      // Fetch the public folder page as a browser would
      const html = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }).then(r => r.text());

      // Google Drive embeds file data as JSON-like structures in the page HTML.
      // File IDs are 28–44 character base64url strings. We look for them paired
      // with image MIME types that appear nearby in the embedded data blobs.
      const seen = new Set<string>();
      const files: { id: string; name: string; thumbnailUrl: string; downloadUrl: string }[] = [];

      // Pattern: ["FILE_ID","FILE_NAME",...,"image/jpeg"] or similar
      const re = /\["([a-zA-Z0-9_-]{25,})",\s*"([^"]+?)",(?:[^]]*?)"(image\/(?:jpeg|png|gif|webp|bmp|heic|tiff))"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const [, id, name] = m;
        if (!seen.has(id)) {
          seen.add(id);
          files.push({
            id,
            name,
            thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w300`,
            downloadUrl: `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
          });
        }
      }

      // Fallback: look for any standalone Drive file IDs in the HTML
      if (files.length === 0) {
        const idRe = /["\/]([a-zA-Z0-9_-]{33})["\/]/g;
        while ((m = idRe.exec(html)) !== null) {
          const id = m[1];
          if (!seen.has(id)) {
            seen.add(id);
            files.push({
              id,
              name: `photo-${files.length + 1}.jpg`,
              thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w300`,
              downloadUrl: `https://drive.google.com/uc?export=download&id=${id}&confirm=t`,
            });
          }
        }
      }

      if (files.length === 0) {
        return res.status(404).json({
          message: 'No images found. Make sure the folder is publicly shared ("Anyone with the link can view").'
        });
      }

      res.json({ files, folderId });
    } catch (error) {
      console.error('Error fetching Drive folder:', error);
      res.status(500).json({ message: 'Failed to fetch Google Drive folder' });
    }
  });

  // Import photos from a URL
  app.post('/api/photos/import-from-url', async (req: Request, res: Response) => {
    try {
      const { urls, names } = req.body;
      
      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ message: 'URLs must be a non-empty array' });
      }
      
      const importResults = [];

      // Ensure uploads directory exists once
      await fs.promises.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
      
      // Process each URL
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          // Use supplied name if available, otherwise derive from URL
          const originalName: string = (Array.isArray(names) && names[i]) ? names[i] : '';
          const ext = originalName.match(/\.(jpe?g|png|gif|webp|bmp|heic|tiff)$/i)?.[0] || '.jpg';
          const baseName = originalName.replace(/\.[^.]+$/, '') || `photo-${i + 1}`;
          const fileName = `import_${Date.now()}_${i}_${baseName.replace(/[^a-z0-9_-]/gi, '_')}${ext}`;
          const filePath = path.join(process.cwd(), 'uploads', fileName);
          
          // Download the image — follow redirects (important for Google Drive)
          const response = await fetch(url, {
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
          }

          // Verify the response is actually an image, not an HTML error page
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            throw new Error('Got an HTML page instead of an image — the file may be too large for direct download or requires sign-in');
          }
          
          // Get the file buffer and save it
          const buffer = await response.arrayBuffer();
          await fs.promises.writeFile(filePath, Buffer.from(buffer));
          
          // Get file size
          const stats = await fs.promises.stat(filePath);

          // Reject empty/tiny files (likely error pages saved as bytes)
          if (stats.size < 1000) {
            await fs.promises.unlink(filePath).catch(() => {});
            throw new Error('Downloaded file is too small — likely not a valid image');
          }
          
          // Extract domain from URL for tags
          let domain = "";
          try {
            const urlObj = new URL(url);
            domain = urlObj.hostname;
          } catch {
            domain = "unknown";
          }
          
          const photoData = {
            filePath,
            fileName: originalName || fileName,
            fileType: 'image',
            fileSize: stats.size,
            width: 0,
            height: 0,
            createdAt: new Date(),
            favorite: false,
            location: null,
            metadata: { originalUrl: url },
            contentTags: [`imported`, `from:${domain}`],
            indexed: true,
            description: `Imported from ${domain}`
          };
          
          // Create photo record
          const newPhoto = await storage.createPhoto(photoData);
          importResults.push({ url, success: true, photoId: newPhoto.id });
        } catch (error) {
          console.error(`Error importing from URL ${url}:`, error);
          importResults.push({ url, success: false, error: 'Failed to import' });
        }
      }
      
      res.json({
        message: 'Import processed',
        results: importResults
      });
      
    } catch (error) {
      console.error('Error importing from URLs:', error);
      res.status(500).json({ message: 'Failed to import photos from URLs' });
    }
  });

  return httpServer;
}
