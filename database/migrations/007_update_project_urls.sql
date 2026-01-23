-- ============================================
-- UPDATE PROJECT URL COLUMNS
-- Replace video_url and external_url with itchio_url, steam_url, youtube_url
-- ============================================

-- Add new columns
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS itchio_url TEXT,
ADD COLUMN IF NOT EXISTS steam_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_url TEXT;

-- Drop old columns (if they exist and you want to remove them)
-- Note: This will lose any existing data in these columns
ALTER TABLE projects
DROP COLUMN IF EXISTS video_url,
DROP COLUMN IF EXISTS external_url;
