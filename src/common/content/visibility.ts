/** SQL fragments take only source-controlled aliases and placeholder names. */
export function contentVisibility(alias: string, viewer: string): string {
  return `(${alias}.status = 'published' OR EXISTS (
    SELECT 1 FROM users content_viewer
    WHERE content_viewer.id = ${viewer} AND content_viewer.is_verified = true
      AND (content_viewer.role = 'admin'
        OR (content_viewer.role = 'writer' AND content_viewer.id = ${alias}.author_id))
  ))`
}

export function commentVisibility(alias: string, viewer: string): string {
  return `(${alias}.status = 'approved' OR EXISTS (
    SELECT 1 FROM users comment_viewer
    WHERE comment_viewer.id = ${viewer} AND comment_viewer.is_verified = true
      AND (comment_viewer.role = 'admin'
        OR (comment_viewer.id = ${alias}.user_id AND ${alias}.status = 'pending'))
  ))
  AND (${alias}.article_id IS NULL OR EXISTS (
    SELECT 1 FROM articles parent_article WHERE parent_article.id = ${alias}.article_id
      AND ${contentVisibility('parent_article', viewer)}
  ))
  AND (${alias}.project_id IS NULL OR EXISTS (
    SELECT 1 FROM projects parent_project WHERE parent_project.id = ${alias}.project_id
      AND ${contentVisibility('parent_project', viewer)}
  ))
  AND (${alias}.article_id IS NOT NULL OR ${alias}.project_id IS NOT NULL)`
}
