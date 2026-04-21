-- Migration: Add project_id link to articles
-- Description: Allows an article to be associated with a single project.
--              Deleting a project sets linked articles' project_id to NULL (no cascade delete).
-- Date: 2026-04-21

ALTER TABLE articles ADD COLUMN IF NOT EXISTS project_id UUID NULL REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_project_id ON articles(project_id);
