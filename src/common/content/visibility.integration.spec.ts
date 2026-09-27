import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { commentVisibility, contentVisibility } from './visibility'

// Uses only temporary tables in a dedicated local test connection.
// TEST_VISIBILITY_SOCKET points to an isolated PostgreSQL Unix socket directory.
const socket = process.env.TEST_VISIBILITY_SOCKET
const client = new Client({ host: socket, port: 55497, database: 'postgres', user: process.env.USER })

describe.skipIf(!socket)('visibility rules against PostgreSQL', () => {
  beforeAll(async () => {
    await client.connect()
    await client.query(`
      CREATE TEMP TABLE users (id text PRIMARY KEY, role text, is_verified boolean);
      CREATE TEMP TABLE articles (id text PRIMARY KEY, author_id text, status text);
      CREATE TEMP TABLE projects (LIKE articles);
      CREATE TEMP TABLE comments (id text PRIMARY KEY, user_id text, status text, article_id text, project_id text);
      INSERT INTO users VALUES ('owner', 'writer', true), ('other', 'writer', true), ('admin', 'admin', true), ('reader', 'reader', true), ('unverified', 'admin', false);
      INSERT INTO articles VALUES ('published', 'owner', 'published'), ('draft', 'owner', 'draft'), ('archived', 'owner', 'archived'), ('reader-draft', 'reader', 'draft');
      INSERT INTO projects SELECT * FROM articles;
      INSERT INTO comments VALUES
        ('public', 'reader', 'approved', 'published', NULL),
        ('pending', 'reader', 'pending', 'published', NULL),
        ('rejected', 'reader', 'rejected', 'published', NULL),
        ('spam', 'reader', 'spam', 'published', NULL),
        ('draft-comment', 'reader', 'approved', 'draft', NULL),
        ('project-comment', 'reader', 'approved', NULL, 'draft'),
        ('orphan', 'reader', 'approved', NULL, NULL);
    `)
  })
  afterAll(async () => { await client.end() })

  for (const table of ['articles', 'projects']) {
    it.each([
      [null, ['published']], ['reader', ['published']], ['other', ['published']],
      ['unverified', ['published']], ['unknown', ['published']],
      ['owner', ['archived', 'draft', 'published']],
      ['admin', ['archived', 'draft', 'published', 'reader-draft']],
    ])(`${table}: viewer %s sees only authorized content`, async (viewer, expected) => {
      const result = await client.query(`SELECT c.id FROM ${table} c WHERE ${contentVisibility('c', '$1')} ORDER BY c.id`, [viewer])
      expect(result.rows.map(row => row.id)).toEqual(expected)
    })
  }

  it.each([
    [null, ['public']], ['other', ['public']], ['unverified', ['public']],
    ['reader', ['pending', 'public']],
    ['owner', ['draft-comment', 'project-comment', 'public']],
    ['admin', ['draft-comment', 'pending', 'project-comment', 'public', 'rejected', 'spam']],
  ])('viewer %s sees only moderated comments on accessible content', async (viewer, expected) => {
    const result = await client.query(`SELECT c.id FROM comments c WHERE ${commentVisibility('c', '$1')} ORDER BY c.id`, [viewer])
    expect(result.rows.map(row => row.id)).toEqual(expected)
  })

  it('applies current account privileges rather than stale token roles', async () => {
    await client.query("UPDATE users SET role = 'reader' WHERE id = 'owner'")
    const result = await client.query(`SELECT a.id FROM articles a WHERE ${contentVisibility('a', '$1')} ORDER BY a.id`, ['owner'])
    expect(result.rows.map(row => row.id)).toEqual(['published'])
  })
})
