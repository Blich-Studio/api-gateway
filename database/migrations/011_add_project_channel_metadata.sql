-- ============================================
-- ADD PROJECT CHANNEL METADATA
-- Channels power the public Archive / Sound / Motion / Play split while
-- keeping project records flexible enough for external platforms and mirrors.
-- ============================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS channel TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT,
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS embed_url TEXT,
ADD COLUMN IF NOT EXISTS license TEXT,
ADD COLUMN IF NOT EXISTS archive_url TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_channel_check'
    ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_channel_check
        CHECK (channel IS NULL OR channel IN ('sound', 'motion', 'play'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_platform_check'
    ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_platform_check
        CHECK (
            platform IS NULL OR platform IN (
                'soundcloud',
                'youtube',
                'dailymotion',
                'vimeo',
                'peertube',
                'itchio',
                'steam',
                'internet_archive',
                'github',
                'codeberg',
                'other'
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_license_check'
    ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_license_check
        CHECK (
            license IS NULL OR license IN (
                'cc0-1.0',
                'cc-by-4.0',
                'cc-by-sa-4.0',
                'cc-by-nc-4.0',
                'cc-by-nc-sa-4.0',
                'mit',
                'apache-2.0',
                'gpl-3.0',
                'proprietary',
                'other'
            )
        );
    END IF;
END $$;

UPDATE projects
SET channel = 'play'
WHERE channel IS NULL AND type = 'game';

UPDATE projects
SET channel = 'motion'
WHERE channel IS NULL AND type = 'animation';

CREATE INDEX IF NOT EXISTS idx_projects_channel ON projects(channel);
CREATE INDEX IF NOT EXISTS idx_projects_platform ON projects(platform);
CREATE INDEX IF NOT EXISTS idx_projects_license ON projects(license);
