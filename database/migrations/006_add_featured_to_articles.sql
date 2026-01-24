-- Migration: Add featured column to articles table
-- Description: Allows marking articles to appear in "From the Studio" section
-- Date: 2025-12-28

ALTER TABLE articles
ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured);
