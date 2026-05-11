CREATE TABLE `album_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`album_id` integer NOT NULL,
	`photo_id` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_album_photos_unique_pair` ON `album_photos` (`album_id`,`photo_id`);--> statement-breakpoint
CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`search_terms` text,
	`date_range_start` integer,
	`date_range_end` integer,
	`created_at` integer NOT NULL,
	`cover_photo_id` integer
);
--> statement-breakpoint
CREATE TABLE `folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`display_path` text,
	`last_scanned` integer,
	`active` integer DEFAULT true
);
--> statement-breakpoint
CREATE UNIQUE INDEX `folders_path_unique` ON `folders` (`path`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` integer NOT NULL,
	`content` text NOT NULL,
	`mood` text,
	`photo_id` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_path` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` integer NOT NULL,
	`width` integer,
	`height` integer,
	`favorite` integer DEFAULT false,
	`description` text,
	`location` text,
	`coordinates` text,
	`journal_entry` text,
	`metadata` text,
	`content_tags` text,
	`indexed` integer DEFAULT false,
	`rotation` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);