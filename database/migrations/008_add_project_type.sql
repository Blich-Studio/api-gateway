-- ============================================
-- ADD PROJECT TYPE COLUMN
-- Predefined project types: game, engine, tool, animation, artwork, other
-- ============================================

-- Add type column with default value
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'other';

-- Add check constraint for valid types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_type_check'
    ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT projects_type_check
        CHECK (type IN ('game', 'engine', 'tool', 'animation', 'artwork', 'other'));
    END IF;
END $$;
