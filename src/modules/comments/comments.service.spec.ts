import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentsService } from './comments.service'
import { CommentQuerySchema, CreateCommentSchema, CommentResponseSchema } from './dto/comment.dto'
import type { PostgresClient } from '../database/postgres.module'
const id = '11111111-1111-4111-8111-111111111111'
const projectId = '22222222-2222-4222-8222-222222222222'
const row = { id, content: 'Useful comment', user_id: id, user_display_name: 'Reader', user_avatar_url: null, article_id: id, project_id: null, parent_id: null, status: 'approved', likes_count: 1, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-01') }
let query: ReturnType<typeof vi.fn>, service: CommentsService
beforeEach(() => {
 query = vi.fn(async (sql:string) => {
  if(sql.includes('COUNT(*)')) return {rows:[{total:'1'}]}
  if(sql.includes('FROM likes')) return {rows:[{comment_id:id}]}
  if(sql.includes('c.parent_id =')) return {rows:[{...row,id:projectId,parent_id:id}]}
  return {rows:[row]}
 })
 service = new CommentsService({query} as unknown as PostgresClient)
})
describe('comment reading and moderation', () => {
 it.each([undefined,id])('returns visible comments and replies for viewer %s', async viewer => {
  const result = await service.findAll(CommentQuerySchema.parse({articleId:id,page:1,limit:10}),viewer)
  expect(result.data[0]).toMatchObject({content:'Useful comment',isLiked:!!viewer})
  expect(result.data[0].replies?.[0]).toMatchObject({parentId:id,content:'Useful comment'})
  expect(result.meta).toMatchObject({total:1,hasNext:false,hasPrev:false})
 })
 it('paginates filtered project comments without replies', async () => {
  query.mockImplementation(async (sql:string) => ({ rows: sql.includes('COUNT(*)') ? [{total:'60'}] : sql.includes('c.parent_id =') ? [] : [row] }))
  const result = await service.findAll(CommentQuerySchema.parse({projectId,page:2,limit:20,status:'pending'}))
  expect(result.meta).toMatchObject({hasNext:true,hasPrev:true});expect(result.data[0].replies).toEqual([])
 })
 it.each([undefined,id])('reads one visible comment with replies for %s', async viewer => {
  const result = await service.findById(id,viewer)
  expect(result.isLiked).toBe(!!viewer);expect(result.replies).toHaveLength(1)
  expect(CommentResponseSchema.parse(result)).toEqual(result)
 })
 it('returns not-found for an inaccessible comment', async () => {query.mockResolvedValueOnce({rows:[]});await expect(service.findById(id)).rejects.toMatchObject({status:404})})
 it.each(['articleId','projectId'] as const)('creates a comment on accessible %s', async parent => {
  const result = await service.create({content:'New comment',[parent]:id},id)
  expect(result.id).toBe(id)
  const insert=query.mock.calls.find(([sql])=>sql.startsWith('INSERT INTO comments'))!
  expect(insert[1]).toEqual(['New comment',id,parent==='articleId'?id:null,parent==='projectId'?id:null,null,'approved'])
 })
 it('creates a reply on the same accessible article', async () => {
  await service.create({content:'Reply',articleId:id,parentId:id},id)
  expect(query.mock.calls[0][0]).toContain('comment_viewer.is_verified = true')
 })
 it.each(['parentId','articleId','projectId'] as const)('rejects an inaccessible %s before insertion', async parent => {
  query.mockResolvedValueOnce({rows:[]})
  await expect(service.create({content:'Reply',[parent]:id},id)).rejects.toMatchObject({status:400})
  expect(query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false)
 })
 it.each(['articleId','projectId'] as const)('rejects replies attached to a different %s', async parent => {
  await expect(service.create({content:'Reply',parentId:id,[parent]:projectId},id)).rejects.toMatchObject({status:400})
 })
 it('allows the author to edit content', async () => { await service.update(id,{content:'Edited'},id);expect(query).toHaveBeenCalledWith('UPDATE comments SET content = $1 WHERE id = $2',['Edited',id]) })
 it('allows admins to moderate status without rewriting content', async () => { await service.update(id,{status:'spam'},'admin',true);expect(query).toHaveBeenCalledWith('UPDATE comments SET status = $1 WHERE id = $2',['spam',id]) })
 it('treats an empty update as a read', async () => {await service.update(id,{},id);expect(query.mock.calls.some(([sql])=>sql.startsWith('UPDATE'))).toBe(false)})
 it('rejects edits to a missing comment', async () => { query.mockResolvedValueOnce({rows:[]});await expect(service.update(id,{content:'Edit'},id)).rejects.toMatchObject({status:404}) })
 it('rejects another user editing content, even an admin', async () => {await expect(service.update(id,{content:'Edit'},'other',true)).rejects.toMatchObject({status:403})})
 it('rejects non-admin moderation', async () => {await expect(service.update(id,{status:'spam'},id)).rejects.toMatchObject({status:403})})
 it.each([[id,false],['admin',true]])('allows authorized deletion by %s',async (viewer,admin)=>{ await service.delete(id,viewer as string,admin as boolean);expect(query).toHaveBeenLastCalledWith('DELETE FROM comments WHERE id = $1',[id]) })
 it('rejects deletion of missing comments',async()=>{query.mockResolvedValueOnce({rows:[]});await expect(service.delete(id,id)).rejects.toMatchObject({status:404})})
 it('rejects unauthorized deletion',async()=>{await expect(service.delete(id,'other')).rejects.toMatchObject({status:403})})
 it('requires exactly one content parent at the request boundary',()=>{
  expect(CreateCommentSchema.safeParse({content:'Hi',articleId:id}).success).toBe(true)
  expect(CreateCommentSchema.safeParse({content:'Hi',projectId}).success).toBe(true)
  expect(CreateCommentSchema.safeParse({content:'Hi'}).success).toBe(false)
  expect(CreateCommentSchema.safeParse({content:'Hi',articleId:id,projectId}).success).toBe(false)
 })
})
