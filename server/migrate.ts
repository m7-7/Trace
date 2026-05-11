import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

const dbPath = process.env.DATABASE_PATH ?? "./trace.db";
const sqlite = new Database(path.resolve(dbPath));
const db = drizzle(sqlite);

console.log("Applying database migrations...");
try {
  migrate(db, { migrationsFolder: path.resolve("./migrations-sqlite") });
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  sqlite.close();
}
