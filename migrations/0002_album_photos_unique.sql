-- Remove duplicate album_photo rows that may exist due to missing uniqueness constraint.
-- For each (album_id, photo_id) pair keep only the row with the lowest id; delete the rest.
-- This must run before the unique index below, otherwise index creation will fail on existing duplicates.
DELETE FROM "album_photos"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "album_photos"
  GROUP BY "album_id", "photo_id"
);

-- Enforce uniqueness at the database level so no duplicate (album_id, photo_id) pair
-- can ever be inserted, regardless of how many concurrent requests arrive.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_album_photos_unique_pair"
  ON "album_photos" ("album_id", "photo_id");
