-- Migration: Add content tables for blog and projects
-- Description: Creates tables for tags, articles, projects, comments, and likes
-- Date: 2025-12-23

-- ============================================
-- TAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL UNIQUE,
  slug VARCHAR(30) NOT NULL UNIQUE,
  description VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- ============================================
-- ARTICLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  perex VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  likes_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);

-- Article-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS article_tags (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON article_tags(tag_id);

-- ============================================
-- PROJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  short_description VARCHAR(500),
  cover_image_url TEXT,
  gallery_urls TEXT[], -- Array of image URLs
  video_url TEXT,
  external_url TEXT,
  github_url TEXT,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured BOOLEAN NOT NULL DEFAULT false,
  likes_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_author_id ON projects(author_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured);
CREATE INDEX IF NOT EXISTS idx_projects_published_at ON projects(published_at);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Project-Tags junction table (many-to-many)
CREATE TABLE IF NOT EXISTS project_tags (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON project_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id ON project_tags(tag_id);

-- ============================================
-- COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Polymorphic association: either article_id or project_id
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  -- Parent comment for replies (null for top-level comments)
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure comment belongs to either article OR project, not both
  CONSTRAINT check_comment_target CHECK (
    (article_id IS NOT NULL AND project_id IS NULL) OR
    (article_id IS NULL AND project_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id) WHERE article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_project_id ON comments(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- ============================================
-- LIKES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Polymorphic association
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure like is for exactly one target
  CONSTRAINT check_like_target CHECK (
    (article_id IS NOT NULL AND project_id IS NULL AND comment_id IS NULL) OR
    (article_id IS NULL AND project_id IS NOT NULL AND comment_id IS NULL) OR
    (article_id IS NULL AND project_id IS NULL AND comment_id IS NOT NULL)
  ),
  -- Unique constraint: one like per user per target
  CONSTRAINT unique_article_like UNIQUE (user_id, article_id),
  CONSTRAINT unique_project_like UNIQUE (user_id, project_id),
  CONSTRAINT unique_comment_like UNIQUE (user_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_article_id ON likes(article_id) WHERE article_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_likes_project_id ON likes(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_likes_comment_id ON likes(comment_id) WHERE comment_id IS NOT NULL;

-- ============================================
-- UPDATE USERS TABLE
-- Add display_name and avatar fields if not present
-- ============================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Set display_name to nickname if not already set
UPDATE users SET display_name = nickname WHERE display_name IS NULL;

-- ============================================
-- TRIGGER FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (idempotent with DROP IF EXISTS)
DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update likes_count on articles
CREATE OR REPLACE FUNCTION update_article_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE articles SET likes_count = likes_count + 1 WHERE id = NEW.article_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE articles SET likes_count = likes_count - 1 WHERE id = OLD.article_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_article_likes_count_trigger ON likes;
CREATE TRIGGER update_article_likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  WHEN (NEW.article_id IS NOT NULL OR OLD.article_id IS NOT NULL)
  EXECUTE FUNCTION update_article_likes_count();

-- Function to update likes_count on projects
CREATE OR REPLACE FUNCTION update_project_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET likes_count = likes_count + 1 WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET likes_count = likes_count - 1 WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_project_likes_count_trigger ON likes;
CREATE TRIGGER update_project_likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  WHEN (NEW.project_id IS NOT NULL OR OLD.project_id IS NOT NULL)
  EXECUTE FUNCTION update_project_likes_count();

-- Function to update likes_count on comments
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments SET likes_count = likes_count - 1 WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_comment_likes_count_trigger ON likes;
CREATE TRIGGER update_comment_likes_count_trigger
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW
  WHEN (NEW.comment_id IS NOT NULL OR OLD.comment_id IS NOT NULL)
  EXECUTE FUNCTION update_comment_likes_count();
