import type { HttpService } from '@nestjs/axios'
import { ForbiddenException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { of } from 'rxjs'
import { EditorialService } from './editorial.service'

const createHttpServiceMock = () => {
  const mock = {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
  }

  return {
    mock,
    service: mock as unknown as HttpService,
  }
}

const createConfigServiceMock = () =>
  ({
    getOrThrow: jest.fn(() => 'http://cms.local'),
  }) as unknown as ConfigService

describe('EditorialService', () => {
  it('allows admins to update any article', async () => {
    const { mock: httpMock, service: httpService } = createHttpServiceMock()
    const configService = createConfigServiceMock()
    const service = new EditorialService(httpService, configService)

    httpMock.get.mockReturnValueOnce(of({ data: { id: 'article-123', authorId: 'writer-other' } }))
    httpMock.patch.mockReturnValueOnce(of({ data: { id: 'article-123', title: 'Updated' } }))

    const result = await service.updateArticle(
      'article-123',
      { title: 'Updated' },
      { userId: 'admin-user', role: 'admin' }
    )

    expect(result).toEqual({ id: 'article-123', title: 'Updated' })
    expect(httpMock.get).toHaveBeenCalledWith('http://cms.local/api/articles/article-123')
    expect(httpMock.patch).toHaveBeenCalledWith('http://cms.local/api/articles/article-123', {
      title: 'Updated',
    })
  })

  it('prevents writers from updating articles they do not own', async () => {
    const { mock: httpMock, service: httpService } = createHttpServiceMock()
    const configService = createConfigServiceMock()
    const service = new EditorialService(httpService, configService)

    httpMock.get.mockReturnValueOnce(
      of({ data: { id: 'article-foreign', authorId: 'writer-someone' } })
    )

    await expect(
      service.updateArticle(
        'article-foreign',
        { title: 'New' },
        {
          userId: 'writer-123',
          role: 'writer',
        }
      )
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(httpMock.patch).not.toHaveBeenCalled()
  })

  it('allows readers to update only their own comments', async () => {
    const { mock: httpMock, service: httpService } = createHttpServiceMock()
    const configService = createConfigServiceMock()
    const service = new EditorialService(httpService, configService)

    httpMock.get.mockReturnValueOnce(of({ data: { id: 'comment-1', userId: 'reader-123' } }))
    httpMock.patch.mockReturnValueOnce(of({ data: { id: 'comment-1', content: 'Updated' } }))

    const payload = { content: 'Updated' }
    const result = await service.updateComment('comment-1', payload, {
      userId: 'reader-123',
      role: 'reader',
    })

    expect(result).toEqual({ id: 'comment-1', content: 'Updated' })
    expect(httpMock.get).toHaveBeenCalledWith('http://cms.local/api/comments/comment-1')
    expect(httpMock.patch).toHaveBeenCalledWith('http://cms.local/api/comments/comment-1', payload)
  })

  it('blocks tag deletions for non-admin users', async () => {
    const { service: httpService } = createHttpServiceMock()
    const configService = createConfigServiceMock()
    const service = new EditorialService(httpService, configService)

    await expect(
      service.deleteTag('tag-123', { userId: 'writer-123', role: 'writer' })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('allows admins to create tags', async () => {
    const { mock: httpMock, service: httpService } = createHttpServiceMock()
    const configService = createConfigServiceMock()
    const service = new EditorialService(httpService, configService)

    httpMock.post.mockReturnValueOnce(of({ data: { id: 'tag-1', name: 'RPG' } }))

    const payload = { name: 'RPG' }
    const result = await service.createTag(payload, { userId: 'admin', role: 'admin' })

    expect(result).toEqual({ id: 'tag-1', name: 'RPG' })
    expect(httpMock.post).toHaveBeenCalledWith('http://cms.local/api/tags', payload)
  })

  it('allows admins to delete tags', async () => {
    const { mock: httpMock, service: httpService } = createHttpServiceMock()
    const configService = createConfigServiceMock()
    const service = new EditorialService(httpService, configService)

    httpMock.delete.mockReturnValueOnce(of({ data: { success: true } }))

    const result = await service.deleteTag('tag-1', { userId: 'admin', role: 'admin' })

    expect(result).toEqual({ success: true })
    expect(httpMock.delete).toHaveBeenCalledWith('http://cms.local/api/tags/tag-1')
  })

  it('blocks tag creation for non-admin users', async () => {
    const { service: httpService } = createHttpServiceMock()
    const configService = createConfigServiceMock()
    const service = new EditorialService(httpService, configService)

    await expect(
      service.createTag({ name: 'NewTag' }, { userId: 'writer', role: 'writer' })
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})
