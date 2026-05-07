CREATE INDEX IF NOT EXISTS "idx_photos_file_path" ON "photos" ("file_path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_photos_favorite" ON "photos" ("favorite");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_photos_created_at" ON "photos" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_photos_content_tags" ON "photos" USING GIN ("content_tags");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_album_photos_album_id" ON "album_photos" ("album_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_album_photos_photo_id" ON "album_photos" ("photo_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_entries_date" ON "journal_entries" ("date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_journal_entries_photo_id" ON "journal_entries" ("photo_id");
