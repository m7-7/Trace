import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, hashPassword, verifyPassword, ADMIN_USERNAME } from "./auth";
import path from "path";
import fs from "fs";
import { execSync, execFile as execFileCb } from "child_process";
import { promisify } from "util";
const execFile = promisify(execFileCb);
import { promises as dnsPromises } from "dns";
import { analyzeImage, initializeModel, modelStatus } from "./imageRecognition";
import sharp from "sharp";
import {
  insertPhotoSchema,
  insertFolderSchema,
  insertAlbumSchema,
  insertJournalEntrySchema,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// Returns true for IPv4/IPv6 addresses in private, loopback, or link-local ranges.
function isPrivateIP(address: string): boolean {
  const ipv4 = address.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    return (
      a === 0 ||                                    // 0.0.0.0/8
      a === 10 ||                                   // RFC 1918
      a === 127 ||                                  // loopback
      (a === 100 && b >= 64 && b <= 127) ||         // carrier-grade NAT
      (a === 169 && b === 254) ||                   // link-local
      (a === 172 && b >= 16 && b <= 31) ||          // RFC 1918
      (a === 192 && b === 168)                      // RFC 1918
    );
  }
  const addr = address.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    addr === "::" ||
    addr === "::1" ||                               // loopback
    addr.startsWith("fc") ||                        // unique local fc00::/7
    addr.startsWith("fd") ||                        // unique local fc00::/7
    addr.startsWith("fe80") ||                      // link-local fe80::/10
    addr.startsWith("::ffff:")                      // IPv4-mapped — underlying addr not rechecked;
                                                    // block the prefix to be safe
  );
}

// Validates that a URL is safe to fetch: https/http only, no private/local IPs.
// NOTE: TOCTOU limitation — the fetch that follows may connect to a different IP
// if DNS changes between this check and the actual request (DNS rebinding).
// Fully preventing DNS rebinding requires a custom HTTP client that reuses the
// validated socket. This check covers the common case of explicitly-private hosts.
async function validateImportUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  // IP literal — check directly without a DNS lookup
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateIP(hostname)) throw new Error("Private and local addresses are not allowed");
    return;
  }
  // Resolve the hostname so we can check the actual IP(s) it maps to
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dnsPromises.lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve hostname");
  }
  for (const { address } of addresses) {
    if (isPrivateIP(address)) throw new Error("URL resolves to a private or local address");
  }
}

// Detect image format from the first bytes of a buffer.
// Returns a format string if recognised, null if the buffer is not a known image.
function detectImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "webp";
  // HEIC/HEIF: ftyp box at offset 4
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "heif";
  // BMP: BM
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "bmp";
  // TIFF: little-endian II or big-endian MM
  if ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a)) return "tiff";
  return null;
}

// Helper to handle file metadata extraction
async function getFileMetadata(filePath: string) {
  const stats = await fs.promises.stat(filePath);
  const fileName = path.basename(filePath);
  const fileType = path.extname(filePath).toLowerCase();

  // Only process images and videos
  const supportedImageTypes = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
  ];
  const supportedVideoTypes = [".mp4", ".mov", ".avi", ".mkv", ".webm"];

  const isImage = supportedImageTypes.includes(fileType);
  const isVideo = supportedVideoTypes.includes(fileType);

  if (!isImage && !isVideo) {
    return null;
  }

  return {
    filePath,
    fileName,
    fileType: isImage ? "image" : "video",
    fileSize: stats.size,
    createdAt: stats.birthtime || stats.mtime, // Use creation time or modification time
  };
}

// Scan directory recursively
async function scanDirectory(directoryPath: string, recursive = true) {
  const entries = await fs.promises.readdir(directoryPath, {
    withFileTypes: true,
  });
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

  // Diagnostic endpoint — no auth required, safe to curl inside the container.
  app.get("/api/diagnostics/sharp", (_req, res) => {
    try {
      const versions = sharp.versions as Record<string, string>;
      const heifFormat = (sharp.format as any).heif;

      let nodePath = "(unknown)";
      let lddLines: string[] = [];
      try {
        nodePath = require.resolve("sharp").replace(/index\.js$/, "");
        const nodeFile = execSync(`find "${nodePath}" -name "*.node" 2>/dev/null | head -1`, { timeout: 3000 })
          .toString().trim();
        if (nodeFile) {
          lddLines = execSync(`ldd "${nodeFile}" 2>/dev/null`, { timeout: 3000 })
            .toString()
            .split("\n")
            .map(l => l.trim())
            .filter(l => /vips|heif|de265/.test(l));
        }
      } catch {}

      res.json({
        sharp: versions.sharp,
        vips: versions.vips,
        heif: versions.heif ?? null,
        heifInputCapable: !!(heifFormat?.input),
        lddVipsHeif: lddLines,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auth endpoints — exempt from requireAuth
  app.get("/api/auth/me", async (req, res) => {
    const admin = await storage.getUserByUsername(ADMIN_USERNAME);
    if (!admin) return res.json({ needsSetup: true });
    if (req.session.authenticated) return res.json({ authenticated: true });
    res.status(401).json({ message: "Unauthorized" });
  });

  app.post("/api/auth/setup", async (req, res) => {
    const existing = await storage.getUserByUsername(ADMIN_USERNAME);
    if (existing) return res.status(403).json({ message: "Already configured" });
    const { password } = req.body;
    if (typeof password !== "string" || password.length < 10) {
      return res.status(400).json({ message: "Password must be at least 10 characters" });
    }
    const hash = await hashPassword(password);
    await storage.createUser({ username: ADMIN_USERNAME, password: hash });
    req.session.authenticated = true;
    res.json({ authenticated: true });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { password } = req.body;
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Password required" });
    }
    const admin = await storage.getUserByUsername(ADMIN_USERNAME);
    if (!admin) return res.status(400).json({ message: "No admin account exists" });
    const valid = await verifyPassword(password, admin.password);
    if (!valid) return res.status(401).json({ message: "Invalid password" });
    req.session.authenticated = true;
    res.json({ authenticated: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/status", (_req, res) => {
    res.json({ model: modelStatus });
  });

  // All remaining /api routes require authentication
  app.use("/api", requireAuth);

  // API routes
  // All routes are prefixed with /api

  // Travel page data — must be registered before /api/photos/:id to avoid catch-all match
  app.get("/api/travel", async (req: Request, res: Response) => {
    try {
      const [placed, unplacedCount] = await Promise.all([
        storage.getPlacedPhotos(),
        storage.getUnplacedPhotoCount(),
      ]);
      res.json({ placed, unplacedCount });
    } catch (error) {
      console.error("Error fetching travel data:", error);
      res.status(500).json({ message: "Failed to fetch travel data" });
    }
  });

  // Get all photos with pagination
  app.get("/api/photos", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const photos = await storage.getPhotos(limit, offset);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  // Get favorite photos (must come before /:id to avoid being treated as an ID)
  app.get("/api/photos/favorites", async (req: Request, res: Response) => {
    try {
      const favorites = await storage.getFavoritePhotos();
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  // Search photos (must come before /:id to avoid being treated as an ID)
  app.get("/api/photos/search", async (req: Request, res: Response) => {
    try {
      const searchQuery = (req.query.q as string) || "";
      const terms = searchQuery.split(" ").filter(Boolean);

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
      console.error("Error searching photos:", error);
      res.status(500).json({ message: "Failed to search photos" });
    }
  });

  // Get photo by ID
  app.get("/api/photos/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid photo ID" });
      }
      const photo = await storage.getPhotoById(id);

      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      res.json(photo);
    } catch (error) {
      console.error("Error fetching photo:", error);
      res.status(500).json({ message: "Failed to fetch photo" });
    }
  });

  // Toggle favorite status
  app.put("/api/photos/:id/favorite", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid photo ID" });
      }
      const photo = await storage.toggleFavorite(id);

      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      res.json(photo);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to toggle favorite" });
    }
  });

  // Get all folders
  app.get("/api/folders", async (req: Request, res: Response) => {
    try {
      const folders = await storage.getFolders();
      res.json(folders);
    } catch (error) {
      console.error("Error fetching folders:", error);
      res.status(500).json({ message: "Failed to fetch folders" });
    }
  });

  // Add a new folder to scan
  app.post("/api/folders", async (req: Request, res: Response) => {
    try {
      const folderData = insertFolderSchema.parse(req.body);

      // Reject null bytes and traversal components.
      if (folderData.path.includes("\0") || folderData.path.includes("..")) {
        return res.status(400).json({ message: "Invalid folder path" });
      }

      const resolvedPath = path.resolve(folderData.path);

      // Verify the path exists, is a directory, and is readable.
      try {
        const stat = await fs.promises.stat(resolvedPath);
        if (!stat.isDirectory()) {
          return res.status(400).json({ message: `"${resolvedPath}" is not a directory.` });
        }
      } catch {
        return res.status(400).json({ message: `"${resolvedPath}" does not exist or is not accessible.` });
      }
      try {
        await fs.promises.access(resolvedPath, fs.constants.R_OK);
      } catch {
        return res.status(400).json({ message: `"${resolvedPath}" is not readable.` });
      }

      folderData.path = resolvedPath;
      const folder = await storage.addFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const readableError = fromZodError(error);
        return res.status(400).json({
          message: "Invalid folder data",
          errors: readableError.message,
        });
      }

      console.error("Error adding folder:", error);
      res.status(500).json({ message: "Failed to add folder" });
    }
  });

  // Delete a folder
  app.delete("/api/folders/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteFolder(id);

      if (!success) {
        return res.status(404).json({ message: "Folder not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting folder:", error);
      res.status(500).json({ message: "Failed to delete folder" });
    }
  });

  // Scan a folder for photos and videos
  app.post("/api/folders/:id/scan", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const folder = await storage.getFolderById(id);

      if (!folder) {
        return res.status(404).json({ message: "Folder not found" });
      }

      // Start scanning process
      res.status(202).json({ message: "Scanning started", folderId: id });

      // Get the folder information
      const folders = await storage.getFolders();
      const folderToScan = folders.find((f) => f.id === id);

      if (!folderToScan) {
        console.error("Folder not found in subsequent scan");
        return;
      }

      // Scan the directory for files
      const files = await scanDirectory(folderToScan.path, true);
      let processedCount = 0;
      let successCount = 0;

      // Query only the discovered paths — avoids loading all photos into memory
      const existingPaths = await storage.getExistingFilePaths(files);

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
          if (metadata.fileType === "image") {
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
            indexed: true,
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

      console.log(
        `Scan completed: Processed ${processedCount} files, added ${successCount} new photos/videos`,
      );
    } catch (error) {
      console.error("Error scanning folder:", error);
    }
  });

  // Get all albums
  app.get("/api/albums", async (req: Request, res: Response) => {
    try {
      const albums = await storage.getAlbums();
      res.json(albums);
    } catch (error) {
      console.error("Error fetching albums:", error);
      res.status(500).json({ message: "Failed to fetch albums" });
    }
  });

  // Get album by ID
  app.get("/api/albums/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const album = await storage.getAlbumById(id);

      if (!album) {
        return res.status(404).json({ message: "Album not found" });
      }

      res.json(album);
    } catch (error) {
      console.error("Error fetching album:", error);
      res.status(500).json({ message: "Failed to fetch album" });
    }
  });

  // Get photos in an album
  app.get("/api/albums/:id/photos", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const album = await storage.getAlbumById(id);

      if (!album) {
        return res.status(404).json({ message: "Album not found" });
      }

      const photos = await storage.getAlbumPhotos(id);
      res.json(photos);
    } catch (error) {
      console.error("Error fetching album photos:", error);
      res.status(500).json({ message: "Failed to fetch album photos" });
    }
  });

  // Add photos to an existing album
  app.post("/api/albums/:id/photos", async (req: Request, res: Response) => {
    try {
      const albumId = parseInt(req.params.id);
      const { photoIds } = req.body;
      if (!Array.isArray(photoIds) || photoIds.length === 0) {
        return res
          .status(400)
          .json({ message: "photoIds must be a non-empty array" });
      }
      const uniquePhotoIds = Array.from(new Set(photoIds.map(Number)));
      for (const photoId of uniquePhotoIds) {
        await storage.addPhotoToAlbum(albumId, photoId);
      }
      // Set cover photo to first added photo if none set
      const album = await storage.getAlbumById(albumId);
      if (album && !album.coverPhotoId) {
        await storage.updateAlbum(albumId, { coverPhotoId: photoIds[0] });
      }
      res.json({ added: photoIds.length });
    } catch (error) {
      console.error("Error adding photos to album:", error);
      res.status(500).json({ message: "Failed to add photos to album" });
    }
  });

  // Create a new album
  app.post("/api/albums", async (req: Request, res: Response) => {
    try {
      const { photoIds, ...rest } = req.body;

      const albumData = insertAlbumSchema.parse({
        ...rest,
        createdAt: new Date(),
      });

      // Create the album
      const album = await storage.createAlbum(albumData);

      // If explicit photoIds provided, use them directly
      let addedPhotoIds: number[] = [];
      if (Array.isArray(photoIds) && photoIds.length > 0) {
        const uniqueIds = Array.from(new Set(photoIds.map(Number)));
        for (const photoId of uniqueIds) {
          await storage.addPhotoToAlbum(album.id, photoId);
        }
        addedPhotoIds = uniqueIds;
      } else {
        // Fall back to tag/date search
        const matchingPhotos = await storage.searchPhotos(
          albumData.searchTerms || [],
          albumData.dateRangeStart || undefined,
          albumData.dateRangeEnd || undefined,
        );
        for (const photo of matchingPhotos) {
          await storage.addPhotoToAlbum(album.id, photo.id);
        }
        addedPhotoIds = matchingPhotos.map((p) => p.id);
      }

      // Set cover photo
      if (addedPhotoIds.length > 0) {
        await storage.updateAlbum(album.id, { coverPhotoId: addedPhotoIds[0] });
      }

      res.status(201).json({
        ...album,
        photoCount: addedPhotoIds.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const readableError = fromZodError(error);
        return res.status(400).json({
          message: "Invalid album data",
          errors: readableError.message,
        });
      }

      console.error("Error creating album:", error);
      res.status(500).json({ message: "Failed to create album" });
    }
  });

  // Delete an album
  app.delete("/api/albums/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAlbum(id);

      if (!success) {
        return res.status(404).json({ message: "Album not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting album:", error);
      res.status(500).json({ message: "Failed to delete album" });
    }
  });

  // Journal entries endpoints
  // Get all journal entries or filtered by date range
  app.get("/api/journal", async (req: Request, res: Response) => {
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
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  // Get journal entry by ID
  app.get("/api/journal/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getJournalEntryById(id);

      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      res.json(entry);
    } catch (error) {
      console.error("Error fetching journal entry:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  // Get journal entries for a specific photo
  app.get("/api/photos/:id/journal", async (req: Request, res: Response) => {
    try {
      const photoId = parseInt(req.params.id);
      const photo = await storage.getPhotoById(photoId);

      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }

      const entries = await storage.getJournalEntriesByPhotoId(photoId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching photo journal entries:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch photo journal entries" });
    }
  });

  // Create a new journal entry
  app.post("/api/journal", async (req: Request, res: Response) => {
    try {
      const entryData = insertJournalEntrySchema.parse({
        ...req.body,
        createdAt: new Date(),
      });

      const entry = await storage.createJournalEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const readableError = fromZodError(error);
        return res.status(400).json({
          message: "Invalid journal entry data",
          errors: readableError.message,
        });
      }

      console.error("Error creating journal entry:", error);
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  // Update a journal entry
  app.put("/api/journal/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getJournalEntryById(id);

      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      const entryData = insertJournalEntrySchema.omit({ createdAt: true }).partial().parse(req.body);
      const updatedEntry = await storage.updateJournalEntry(id, entryData);
      res.json(updatedEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const readableError = fromZodError(error);
        return res.status(400).json({ message: "Invalid journal entry data", errors: readableError.message });
      }
      console.error("Error updating journal entry:", error);
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  // Delete a journal entry
  app.delete("/api/journal/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteJournalEntry(id);

      if (!success) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  // Add description to photo (a "trace")
  app.put(
    "/api/photos/:id/description",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const photo = await storage.getPhotoById(id);

        if (!photo) {
          return res.status(404).json({ message: "Photo not found" });
        }

        const { description } = req.body;

        if (typeof description !== "string") {
          return res
            .status(400)
            .json({ message: "Description must be a string" });
        }

        const updatedPhoto = await storage.updatePhoto(id, { description });
        res.json(updatedPhoto);
      } catch (error) {
        console.error("Error updating photo description:", error);
        res.status(500).json({ message: "Failed to update photo description" });
      }
    },
  );

  // Assign or update location coordinates on a photo (for future manual placement UI)
  app.put("/api/photos/:id/location", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid photo ID" });

      const photo = await storage.getPhotoById(id);
      if (!photo) return res.status(404).json({ message: "Photo not found" });

      const { coordinates, location } = req.body;

      if (coordinates !== null && coordinates !== undefined) {
        const { lat, lng } = coordinates ?? {};
        if (
          typeof lat !== "number" || typeof lng !== "number" ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180
        ) {
          return res.status(400).json({ message: "coordinates.lat must be -90..90 and coordinates.lng must be -180..180" });
        }
      }

      const update: Record<string, unknown> = { coordinates: coordinates ?? null };
      if (location !== undefined) {
        if (typeof location !== "string" && location !== null) {
          return res.status(400).json({ message: "location must be a string or null" });
        }
        update.location = location ?? null;
      }

      const updatedPhoto = await storage.updatePhoto(id, update as any);
      res.json(updatedPhoto);
    } catch (error) {
      console.error("Error updating photo location:", error);
      res.status(500).json({ message: "Failed to update photo location" });
    }
  });

  // Update tags on a photo (manual add/remove)
  app.patch("/api/photos/:id/tags", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid photo ID" });

      const photo = await storage.getPhotoById(id);
      if (!photo) return res.status(404).json({ message: "Photo not found" });

      const { tags } = req.body;
      if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
        return res.status(400).json({ message: "tags must be an array of strings" });
      }

      const seen = new Set<string>();
      const normalized: string[] = [];
      for (const t of tags) {
        const s = t.trim().toLowerCase();
        if (s.length > 0 && !seen.has(s)) { seen.add(s); normalized.push(s); }
      }

      const updatedPhoto = await storage.updatePhoto(id, { contentTags: normalized });
      res.json(updatedPhoto);
    } catch (error) {
      console.error("Error updating photo tags:", error);
      res.status(500).json({ message: "Failed to update photo tags" });
    }
  });

  // Update manual rotation on a photo (0 / 90 / 180 / 270)
  app.patch("/api/photos/:id/rotation", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid photo ID" });

      const photo = await storage.getPhotoById(id);
      if (!photo) return res.status(404).json({ message: "Photo not found" });

      const { rotation } = req.body;
      if (![0, 90, 180, 270].includes(rotation)) {
        return res.status(400).json({ message: "rotation must be 0, 90, 180, or 270" });
      }

      const updatedPhoto = await storage.updatePhoto(id, { rotation });
      res.json(updatedPhoto);
    } catch (error) {
      console.error("Error updating photo rotation:", error);
      res.status(500).json({ message: "Failed to update photo rotation" });
    }
  });

  // Add description to folder (a "trace")
  app.put(
    "/api/folders/:id/description",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const folder = await storage.getFolderById(id);

        if (!folder) {
          return res.status(404).json({ message: "Folder not found" });
        }

        const { description } = req.body;

        if (typeof description !== "string") {
          return res
            .status(400)
            .json({ message: "Description must be a string" });
        }

        // We need to add this method to the storage interface
        const updatedFolder = await storage.updateFolder(id, { description });
        res.json(updatedFolder);
      } catch (error) {
        console.error("Error updating folder description:", error);
        res
          .status(500)
          .json({ message: "Failed to update folder description" });
      }
    },
  );

  // Add description to album (a "trace")
  app.put(
    "/api/albums/:id/description",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const album = await storage.getAlbumById(id);

        if (!album) {
          return res.status(404).json({ message: "Album not found" });
        }

        const { description } = req.body;

        if (typeof description !== "string") {
          return res
            .status(400)
            .json({ message: "Description must be a string" });
        }

        // We need to add this method to the storage interface
        const updatedAlbum = await storage.updateAlbum(id, { description });
        res.json(updatedAlbum);
      } catch (error) {
        console.error("Error updating album description:", error);
        res.status(500).json({ message: "Failed to update album description" });
      }
    },
  );

  // Serve static photos and videos
  app.get("/api/media/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const photo = await storage.getPhotoById(id);

      if (!photo) {
        return res.status(404).json({ message: "Media not found" });
      }

      // Check if file exists
      try {
        await fs.promises.access(photo.filePath, fs.constants.R_OK);
      } catch (error) {
        return res.status(404).json({ message: "Media file not found" });
      }

      // Determine MIME type
      let contentType = "application/octet-stream";
      if (photo.fileType === "image") {
        const ext = path.extname(photo.filePath).toLowerCase();
        switch (ext) {
          case ".jpg":
          case ".jpeg":
            contentType = "image/jpeg";
            break;
          case ".png":
            contentType = "image/png";
            break;
          case ".gif":
            contentType = "image/gif";
            break;
          case ".webp":
            contentType = "image/webp";
            break;
          case ".bmp":
            contentType = "image/bmp";
            break;
        }
      } else if (photo.fileType === "video") {
        const ext = path.extname(photo.filePath).toLowerCase();
        switch (ext) {
          case ".mp4":
            contentType = "video/mp4";
            break;
          case ".mov":
            contentType = "video/quicktime";
            break;
          case ".avi":
            contentType = "video/x-msvideo";
            break;
          case ".webm":
            contentType = "video/webm";
            break;
        }
      }

      res.setHeader("Content-Type", contentType);
      fs.createReadStream(photo.filePath).pipe(res);
    } catch (error) {
      console.error("Error serving media:", error);
      res.status(500).json({ message: "Failed to serve media" });
    }
  });

  // Fetch file list from a public Google Drive folder
  app.post(
    "/api/photos/fetch-from-drive",
    async (req: Request, res: Response) => {
      try {
        const { url } = req.body;
        if (!url || typeof url !== "string") {
          return res.status(400).json({ message: "URL is required" });
        }

        // Extract folder ID from any Drive folder URL format
        const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (!folderMatch) {
          return res.status(400).json({
            message:
              "Invalid Google Drive folder URL. Make sure it contains /folders/ in the path.",
          });
        }
        const folderId = folderMatch[1];

        let resourceKey = "";
        try {
          resourceKey = new URL(url).searchParams.get("resourcekey") || "";
        } catch {}
        const resourceKeyParam = resourceKey
          ? `&resourcekey=${encodeURIComponent(resourceKey)}`
          : "";

        // Fetch the public folder page as a browser would
        const driveResp = await fetch(
          `https://drive.google.com/drive/folders/${folderId}${resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : ""}`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
            },
          },
        );
        const html = await driveResp.text();

        // Detect redirects to Google login or explicit access-denied pages.
        // URL checks are reliable: if the final URL (after redirect-following) lands on
        // accounts.google.com, Drive did not serve us the folder.
        // Title check is safe: the <title> is page-type-specific and won't contain these
        // strings on a normal public folder page, unlike body content which includes all
        // possible UI action labels in embedded JS regardless of folder visibility.
        const finalUrl = driveResp.url ?? "";
        const isAccessDenied =
          finalUrl.includes("accounts.google.com") ||
          /ServiceLogin|CheckCookie/.test(finalUrl) ||
          /<title>[^<]*(Sign in - Google Accounts|Request access|You need access)[^<]*<\/title>/i.test(html);

        if (isAccessDenied) {
          return res.status(403).json({
            message:
              "This Google Drive folder is not accessible. Set sharing to \"Anyone with the link can view\" and try again.",
          });
        }

        // Google Drive embeds file data as JSON-like structures in the page HTML.
        // File IDs are 28–44 character base64url strings. We look for them paired
        // with image MIME types that appear nearby in the embedded data blobs.
        // The MIME-type requirement prevents false positives from navigation tokens
        // and other base64url-looking strings present in all Google HTML pages.
        const seen = new Set<string>();
        const files: {
          id: string;
          name: string;
          thumbnailUrl: string;
          downloadUrl: string;
        }[] = [];

        // Primary: unescaped format — ["FILE_ID","FILE_NAME",...,"image/jpeg"]
        const re =
          /\["([a-zA-Z0-9_-]{25,})",\s*"([^"]+?)",(?:[^]]*?)"(image\/(?:jpeg|png|gif|webp|bmp|heic|heif|tiff))"/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html)) !== null) {
          const [, id, name] = m;
          if (!seen.has(id)) {
            seen.add(id);
            files.push({
              id,
              name,
              thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w300${resourceKeyParam}`,
              downloadUrl: `https://drive.google.com/uc?export=download&id=${id}&confirm=t${resourceKeyParam}`,
            });
          }
        }

        // Secondary: Drive sometimes embeds all file data as \xNN hex-escaped JS string
        // literals. Decode them, then match the actual structure:
        //   ["FILE_ID",["FOLDER_ID"],"FILENAME","image/type"]
        // Only runs when the primary regex finds nothing (e.g. this specific folder type).
        // Safe to run here because access-denied has already been checked above.
        if (files.length === 0) {
          const decoded = html
            .replace(/\\x([0-9a-fA-F]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
            .replace(/\\\//g, '/');
          const re2 = /\["([a-zA-Z0-9_-]{25,})",\["[a-zA-Z0-9_-]+"\],"([^"]+?)","(image\/[^"]+?)"/g;
          while ((m = re2.exec(decoded)) !== null) {
            const [, id, name] = m;
            if (!seen.has(id)) {
              seen.add(id);
              files.push({
                id,
                name,
                thumbnailUrl: `https://drive.google.com/thumbnail?id=${id}&sz=w300${resourceKeyParam}`,
                downloadUrl: `https://drive.google.com/uc?export=download&id=${id}&confirm=t${resourceKeyParam}`,
              });
            }
          }
        }

        if (files.length === 0) {
          return res.status(404).json({
            message:
              "No images found in this folder. Make sure the folder contains images and is shared as \"Anyone with the link can view\".",
          });
        }

        res.json({ files, folderId });
      } catch (error) {
        console.error("Error fetching Drive folder:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch Google Drive folder" });
      }
    },
  );

  // Import photos from a URL
  app.post(
    "/api/photos/import-from-url",
    async (req: Request, res: Response) => {
      try {
        const { urls, names } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
          return res
            .status(400)
            .json({ message: "URLs must be a non-empty array" });
        }
        if (urls.length > 50) {
          return res.status(400).json({ message: "Cannot import more than 50 URLs at once" });
        }

        const importResults = [];

        // Ensure uploads directory exists once
        await fs.promises.mkdir(path.join(process.cwd(), "uploads"), {
          recursive: true,
        });

        // Process each URL
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          try {
            // Use supplied name if available, otherwise derive from URL
            const originalName: string =
              Array.isArray(names) && names[i] ? names[i] : "";
            const ext =
              originalName.match(
                /\.(jpe?g|png|gif|webp|bmp|heic|tiff)$/i,
              )?.[0] || ".jpg";
            const baseName =
              originalName.replace(/\.[^.]+$/, "") || `photo-${i + 1}`;
            // const fileName = `import_${Date.now()}_${i}_${baseName.replace(/[^a-z0-9_-]/gi, "_")}${ext}`;
            // const filePath = path.join(process.cwd(), "uploads", fileName);

            // Validate URL before fetching: scheme, private IPs, DNS resolution
            await validateImportUrl(url);

            // Download the image — follow redirects (important for Google Drive)
            const response = await fetch(url, {
              redirect: "follow",
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
            });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            // Reject early only for content-types that are unambiguously not images
            // (e.g. HTML error pages, JSON). octet-stream and missing types pass through
            // and are validated by magic-byte inspection after download.
            const contentType = response.headers.get("content-type") || "";
            const contentTypeIsImage = contentType.startsWith("image/");
            const contentTypeIsObviouslyWrong =
              contentType.startsWith("text/") ||
              contentType.startsWith("application/json") ||
              contentType.startsWith("application/xml");
            if (contentTypeIsObviouslyWrong) {
              throw new Error(`Unexpected content-type: ${contentType}`);
            }

            // Reject files over 50 MB — check header first, then buffer after download
            const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
            const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
            if (contentLength > MAX_IMPORT_BYTES) {
              throw new Error("File exceeds the 50 MB import limit");
            }

            // Get the file buffer and save it raw first
            const rawBuffer = Buffer.from(await response.arrayBuffer());

            if (rawBuffer.length > MAX_IMPORT_BYTES) {
              throw new Error("File exceeds the 50 MB import limit");
            }

            // Reject empty/tiny files (likely error pages)
            if (rawBuffer.length < 1000) {
              throw new Error(
                "Downloaded file is too small — likely not a valid image",
              );
            }

            // Always detect magic-byte type — used both for validation and failure diagnostics.
            const detectedType = detectImageType(rawBuffer);

            // For non-image content-types (octet-stream, missing, etc.), confirm
            // the buffer is actually an image via magic bytes before proceeding.
            if (!contentTypeIsImage && !detectedType) {
              throw new Error(
                `File does not appear to be a valid image (content-type: ${contentType || "(none)"})`,
              );
            }

            // Save raw file first, then convert to JPEG with ImageMagick
            // This handles HEIF/HEIC (iPhone), PNG, WebP, etc. — anything browsers can't display natively.
            const importId = Date.now();
            const safeBaseName = baseName.replace(/[^a-z0-9_-]/gi, "_");

            const rawFileName = `import_${importId}_${i}_${safeBaseName}${ext}`;
            const rawPath = path.join(
              process.cwd(),
              "uploads",
              rawFileName + ".raw",
            );

            const jpgFileName = `import_${importId}_${i}_${safeBaseName}.jpg`;
            const jpgFilePath = path.join(
              process.cwd(),
              "uploads",
              jpgFileName,
            );

            await fs.promises.writeFile(rawPath, rawBuffer);

            try {
              if (detectedType === "heif") {
                // Sharp's bundled libheif lacks H.265/HEVC support.
                // Use heif-convert (libheif-examples) which links system libde265.
                await execFile("heif-convert", [rawPath, jpgFilePath], { timeout: 30_000 })
                  .catch(async (err: any) => {
                    const msg = err.stderr || err.message || String(err);
                    throw new Error(`heif-convert: ${msg}`);
                  });
                // heif-convert produces flat JPEG; re-run through sharp for rotation only.
                const rotated = await sharp(jpgFilePath).rotate().jpeg({ quality: 90 }).toBuffer();
                await fs.promises.writeFile(jpgFilePath, rotated);
              } else {
                await sharp(rawBuffer).rotate().jpeg({ quality: 90 }).toFile(jpgFilePath);
              }
              await fs.promises.unlink(rawPath).catch(() => {});
            } catch (convErr) {
              await fs.promises.unlink(rawPath).catch(() => {});
              const convMessage = convErr instanceof Error ? convErr.message : String(convErr);
              console.error(
                `[import] conversion failed` +
                ` name="${originalName}"` +
                ` content-type="${contentType || "(none)"}"` +
                ` detected="${detectedType ?? "unknown"}"` +
                ` size=${rawBuffer.length}B` +
                ` error="${convMessage}"`,
              );
              throw new Error(
                `Conversion failed (${detectedType ?? "unknown format"}): ${convMessage}`,
              );
            }

            const finalPath = jpgFilePath;
            const finalName = jpgFileName;

            // Get file size
            const stats = await fs.promises.stat(finalPath);

            // Extract domain from URL for tags
            let domain = "";
            try {
              const urlObj = new URL(url);
              domain = urlObj.hostname;
            } catch {
              domain = "unknown";
            }

            const photoData = {
              filePath: finalPath,
              fileName: finalName,
              fileType: "image",
              fileSize: stats.size,
              width: 0,
              height: 0,
              createdAt: new Date(),
              favorite: false,
              location: null,
              metadata: { originalUrl: url },
              contentTags: [`imported`, `from:${domain}`],
              indexed: true,
              description: `Imported from ${domain}`,
            };

            // Create photo record
            const newPhoto = await storage.createPhoto(photoData);
            importResults.push({ url, success: true, photoId: newPhoto.id });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to import";
            console.error(`[import] failed url="${url}" error="${message}"`);
            importResults.push({ url, success: false, error: message });
          }
        }

        const successCount = importResults.filter(r => r.success).length;
        const failCount = importResults.length - successCount;
        res.json({
          message: "Import processed",
          results: importResults,
          successCount,
          failCount,
        });
      } catch (error) {
        console.error("Error importing from URLs:", error);
        res.status(500).json({ message: "Failed to import photos from URLs" });
      }
    },
  );

  // One-time endpoint: convert any HEIF/incompatible photos already in the DB to JPEG
  app.post(
    "/api/photos/convert-existing",
    async (req: Request, res: Response) => {
      try {
        const allPhotos = await storage.getPhotos(10000, 0);
        const results: { id: number; status: string }[] = [];

        for (const photo of allPhotos) {
          try {
            // Read the file and let sharp detect the real format
            const meta = await sharp(photo.filePath).metadata();
            const format = meta.format;

            // Only convert non-JPEG formats (heif, heic, png, webp, tiff, etc.)
            if (format === "jpeg") {
              results.push({ id: photo.id, status: "already_jpeg" });
              continue;
            }

            // Build a new JPEG path next to the original
            const dir = path.dirname(photo.filePath);
            const base = path.basename(
              photo.filePath,
              path.extname(photo.filePath),
            );
            const newPath = path.join(dir, `${base}_converted.jpg`);

            await sharp(photo.filePath)
              .rotate()
              .jpeg({ quality: 90 })
              .toFile(newPath);

            // Update the DB record to point to the converted file
            const newStats = await fs.promises.stat(newPath);
            await storage.updatePhoto(photo.id, {
              filePath: newPath,
              fileName: path.basename(newPath),
              fileSize: newStats.size,
            });

            results.push({ id: photo.id, status: `converted from ${format}` });
          } catch (err: any) {
            results.push({ id: photo.id, status: `error: ${err.message}` });
          }
        }

        res.json({
          converted: results.filter((r) => r.status.startsWith("converted"))
            .length,
          results,
        });
      } catch (error) {
        console.error("Conversion error:", error);
        res.status(500).json({ message: "Conversion failed" });
      }
    },
  );

  return httpServer;
}
