CREATE TABLE IF NOT EXISTS "album_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"album_id" integer NOT NULL,
	"photo_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "albums" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"search_terms" text[],
	"date_range_start" timestamp,
	"date_range_end" timestamp,
	"created_at" timestamp NOT NULL,
	"cover_photo_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_path" text,
	"last_scanned" timestamp,
	"active" boolean DEFAULT true,
	CONSTRAINT "folders_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"content" text NOT NULL,
	"mood" text,
	"photo_id" integer,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"width" integer,
	"height" integer,
	"favorite" boolean DEFAULT false,
	"description" text,
	"location" text,
	"coordinates" jsonb,
	"journal_entry" text,
	"metadata" jsonb,
	"content_tags" text[],
	"indexed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
