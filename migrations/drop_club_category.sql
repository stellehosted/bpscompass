-- Clubs no longer have a category (academic, arts, sports, ...).
-- Run this BEFORE deploying the code that stops sending `category`: the column is
-- NOT NULL, so creating a club without it would fail until the column is gone.
--   psql "$DATABASE_URL" -f migrations/drop_club_category.sql
-- Safe to re-run. This permanently deletes the stored category values.

DROP INDEX IF EXISTS idx_clubs_category;
ALTER TABLE clubs DROP COLUMN IF EXISTS category;
