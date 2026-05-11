import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolveDbPath, resolveMigrationsDir } from "./paths";

const sqlite = new Database(resolveDbPath());
const db = drizzle(sqlite);

console.log("Applying database migrations...");
try {
  migrate(db, { migrationsFolder: resolveMigrationsDir() });
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  sqlite.close();
}
