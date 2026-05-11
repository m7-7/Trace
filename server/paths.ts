import path from "path";
import fs from "fs";

// Central path resolver for all runtime directories.
// All values are derived lazily (via functions) so callers always see the
// current environment — important for scripts that load .env before calling.
//
// Future Electron hook: replace the three resolve* functions here to return
// paths under app.getPath('userData') and app.getAppPath() instead of CWD.

// Default DB lives in ./data/ rather than the repo root to keep SQLite
// artifacts out of the working tree. DATABASE_PATH overrides this entirely.
export function resolveDbPath(): string {
  return path.resolve(process.env.DATABASE_PATH ?? "./data/trace.db");
}

export function resolveUploadsDir(): string {
  return path.resolve(process.cwd(), "uploads");
}

export function resolveMigrationsDir(): string {
  return path.resolve("./migrations-sqlite");
}

// Creates the parent directory of the given DB file path.
// Called by db.ts and migrate.ts before opening the database so SQLite
// never fails with SQLITE_CANTOPEN due to a missing parent directory.
export function ensureDataDir(dbFilePath: string): void {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
}

// Creates the uploads directory if it does not already exist.
export function ensureUploadsDir(): void {
  fs.mkdirSync(resolveUploadsDir(), { recursive: true });
}
