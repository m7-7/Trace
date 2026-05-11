import path from "path";

// Central path resolver for all runtime directories.
// All values are derived lazily (via functions) so callers always see the
// current environment — important for scripts that load .env before calling.
//
// Future Electron hook: replace the three resolve* functions here to return
// paths under app.getPath('userData') and app.getAppPath() instead of CWD.

export function resolveDbPath(): string {
  return path.resolve(process.env.DATABASE_PATH ?? "./trace.db");
}

export function resolveUploadsDir(): string {
  return path.resolve(process.cwd(), "uploads");
}

export function resolveMigrationsDir(): string {
  return path.resolve("./migrations-sqlite");
}
