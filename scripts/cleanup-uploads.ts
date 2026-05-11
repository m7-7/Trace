/**
 * Orphan detector / cleanup script for the uploads directory.
 *
 * Dry-run (default — safe, no deletions):
 *   npx tsx scripts/cleanup-uploads.ts
 *
 * Actually delete orphans:
 *   npx tsx scripts/cleanup-uploads.ts --delete
 *
 * The script compares every file in uploads/ against file_path values
 * stored in the photos table.  Files not referenced by any DB record
 * are considered orphans.
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

// Load .env from project root (no dotenv dependency needed)
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const DELETE_MODE = process.argv.includes("--delete");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function main() {
  const dbPath = path.resolve(process.env.DATABASE_PATH ?? "./trace.db");
  const db = new Database(dbPath, { readonly: true });

  try {
    // Fetch every file_path the DB currently references.
    const rows = db.prepare("SELECT file_path FROM photos").all() as { file_path: string }[];
    const referencedPaths = new Set(rows.map((r) => r.file_path));

    console.log(`DB references: ${referencedPaths.size} file(s)`);

    // List everything in uploads/.
    let uploadedFiles: string[];
    try {
      uploadedFiles = fs
        .readdirSync(UPLOADS_DIR)
        .filter((f) => !f.startsWith("."))
        .map((f) => path.join(UPLOADS_DIR, f));
    } catch {
      console.error(`Could not read uploads directory: ${UPLOADS_DIR}`);
      process.exit(1);
    }

    console.log(`Files on disk:  ${uploadedFiles.length} file(s)`);

    const orphans = uploadedFiles.filter((f) => !referencedPaths.has(f));
    const kept = uploadedFiles.length - orphans.length;

    console.log(`\nKept (referenced): ${kept}`);
    console.log(`Orphans found:     ${orphans.length}\n`);

    if (orphans.length === 0) {
      console.log("Nothing to clean up.");
      return;
    }

    // Print orphan list.
    for (const f of orphans) {
      const size = fs.statSync(f).size;
      const kb = (size / 1024).toFixed(1);
      console.log(`  ${DELETE_MODE ? "DELETING" : "ORPHAN  "} ${path.basename(f)}  (${kb} KB)`);
    }

    if (!DELETE_MODE) {
      const totalKb = orphans
        .reduce((sum, f) => sum + fs.statSync(f).size, 0) / 1024;
      console.log(
        `\nDry run — ${orphans.length} orphan(s), ${totalKb.toFixed(1)} KB recoverable.`,
      );
      console.log("Re-run with --delete to remove them.");
      return;
    }

    // Delete mode.
    let deleted = 0;
    let failed = 0;
    for (const f of orphans) {
      try {
        fs.unlinkSync(f);
        deleted++;
      } catch (err: any) {
        console.error(`  Failed to delete ${path.basename(f)}: ${err.message}`);
        failed++;
      }
    }
    console.log(`\nDeleted ${deleted} file(s)${failed > 0 ? `, ${failed} failed` : ""}.`);
  } finally {
    db.close();
  }
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
