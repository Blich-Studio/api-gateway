import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UsersService } from './users.service'
import { UserQuerySchema } from './dto/user.dto'
import type { PostgresClient } from '../database/postgres.module'
import * as bcrypt from 'bcrypt'
vi.mock('bcrypt', () => ({ hash: vi.fn(async () => 'hashed-password') }))
const row = { id: 'user', email: 'user@example.test', nickname: 'Tester', first_name: null, last_name: null, role: 'writer', is_verified: true, avatar_url: null, created_at: new Date('2026-01-01'), last_login_at: null }
let query: ReturnType<typeof vi.fn>, service: UsersService
const sendEmail = vi.fn(async (_data: unknown): Promise<void> => undefined)
beforeEach(() => {
 query = vi.fn().mockResolvedValue({ rows: [row] }); sendEmail.mockReset().mockResolvedValue(undefined)
 service = new UsersService({ query } as unknown as PostgresClient, { sendEmail })
})
describe('user administration', () => {
 it('returns filtered paginated users without credential fields', async () => {
  query.mockResolvedValueOnce({ rows: [{ total: '25' }] }).mockResolvedValueOnce({ rows: [{ ...row, last_login_at: new Date('2026-02-01'), password_hash: 'private' }] })
  const result = await service.findAll(UserQuerySchema.parse({ role: 'writer', isVerified: true, search: 'test', page: 2, limit: 10, sort: 'email', order: 'asc' }))
  expect(result.meta).toMatchObject({ total: 25, hasNext: true, hasPrev: true })
  expect(result.data[0]).toMatchObject({ lastLoginAt: '2026-02-01T00:00:00.000Z' })
  expect(result.data[0]).not.toHaveProperty('password_hash')
  expect(query.mock.calls[1][1]).toEqual(['writer', true, '%test%', 10, 10])
 })
 it('returns an empty first page without filters', async () => {
  query.mockResolvedValue({ rows: [] }); const result = await service.findAll(UserQuerySchema.parse({}))
  expect(result.meta).toMatchObject({ total: 0, hasNext: false, hasPrev: false }); expect(result.data).toEqual([])
 })
 it('maps nullable user profile fields', async () => { expect(await service.findById('user')).toMatchObject({ lastLoginAt: null, firstName: null }) })
 it.each(['findById','updateRole','updateVerification','resetPassword'] as const)('%s rejects an unknown account', async method => {
  query.mockResolvedValue({ rows: [] })
  const action = method === 'findById' ? service.findById('missing') : method === 'updateRole' ? service.updateRole('missing', { role: 'reader' }, 'admin') : method === 'updateVerification' ? service.updateVerification('missing', { isVerified: false }) : service.resetPassword('missing', { newPassword: 'new-password', sendEmail: false })
  await expect(action).rejects.toMatchObject({ status: 404 }); expect(sendEmail).not.toHaveBeenCalled()
 })
 it('rejects self-demotion before writing', async () => {
  await expect(service.updateRole('admin', { role: 'reader' }, 'admin')).rejects.toMatchObject({ status: 403 }); expect(query).not.toHaveBeenCalled()
 })
 it('updates another account role', async () => { query.mockResolvedValue({ rows: [{ ...row, role: 'reader' }] }); expect(await service.updateRole('user', { role: 'reader' }, 'admin')).toMatchObject({ role: 'reader' }); expect(query.mock.calls[0][1]).toEqual(['reader', 'user']) })
 it.each([true,false])('sets verification to %s while coupling revocation in the write', async isVerified => {
  query.mockResolvedValue({ rows: [{ ...row, is_verified: isVerified }] })
  expect(await service.updateVerification('user', { isVerified })).toMatchObject({ isVerified })
  expect(query.mock.calls[0][0]).toContain('refresh_token = CASE WHEN $1 THEN refresh_token ELSE NULL END')
 })
 it.each([false,true])('resets password and honors sendEmail=%s', async notify => {
  const result = await service.resetPassword('user', { newPassword: 'new-password', sendEmail: notify })
  expect(result.emailSent).toBe(notify)
  expect(bcrypt.hash).toHaveBeenCalledWith('new-password',12)
  expect(query.mock.calls[0][0]).toContain('refresh_token = NULL')
  expect(query.mock.calls[0][1]).toEqual(['hashed-password','user'])
  expect(sendEmail).toHaveBeenCalledTimes(notify ? 1 : 0)
 })
 it('keeps a completed reset when notification delivery fails', async () => {
  sendEmail.mockRejectedValue(new Error('Unavailable'))
  await expect(service.resetPassword('user',{ newPassword:'new-password',sendEmail:true })).resolves.toMatchObject({ message:'Password reset successfully' })
 })
 it('rejects self-deletion before database access', async () => { await expect(service.delete('admin','admin')).rejects.toMatchObject({status:403}); expect(query).not.toHaveBeenCalled() })
 it('rejects deletion of an unknown user', async () => { query.mockResolvedValue({rows:[]}); await expect(service.delete('missing','admin')).rejects.toMatchObject({status:404}) })
 it('rejects deletion of another admin', async () => { query.mockResolvedValue({rows:[{role:'admin'}]}); await expect(service.delete('user','admin')).rejects.toMatchObject({status:403}); expect(query).toHaveBeenCalledOnce() })
 it('deletes an ordinary account', async () => { await expect(service.delete('user','admin')).resolves.toEqual({message:'User deleted successfully'}); expect(query).toHaveBeenLastCalledWith('DELETE FROM users WHERE id = $1',['user']) })
})
