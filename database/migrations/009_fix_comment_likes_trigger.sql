-- Migration: Fix comment likes_count trigger
-- Description: The original update_comment_likes_count_trigger used WHEN (OLD.comment_id IS NOT NULL)
--              which evaluates to FALSE on INSERT (OLD is NULL for inserts), so likes_count never
--              incremented for comments. Split into separate INSERT and DELETE triggers like articles/projects.
-- Date: 2026-04-05

-- Drop the broken combined trigger
DROP TRIGGER IF EXISTS update_comment_likes_count_trigger ON likes;

-- INSERT trigger: fires when a like is added to a comment
CREATE TRIGGER update_comment_likes_count_insert_trigger
  AFTER INSERT ON likes
  FOR EACH ROW
  WHEN (NEW.comment_id IS NOT NULL)
  EXECUTE FUNCTION update_comment_likes_count();

-- DELETE trigger: fires when a like is removed from a comment
CREATE TRIGGER update_comment_likes_count_delete_trigger
  AFTER DELETE ON likes
  FOR EACH ROW
  WHEN (OLD.comment_id IS NOT NULL)
  EXECUTE FUNCTION update_comment_likes_count();
