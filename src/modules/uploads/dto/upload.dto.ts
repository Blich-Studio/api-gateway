import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// Upload Response DTO
export const UploadResponseSchema = z.object({
  url: z.string().url(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  bucket: z.string(),
  path: z.string(),
  uploadedAt: z.string().datetime(),
})

export class UploadResponseDto extends createZodDto(UploadResponseSchema) {}

// Signed URL Request DTO (for direct upload from client)
export const SignedUrlRequestSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().min(1, 'Content type is required'),
  folder: z.enum(['articles', 'projects', 'avatars', 'general']).default('general'),
})

export class SignedUrlRequestDto extends createZodDto(SignedUrlRequestSchema) {}

// Signed URL Response DTO
export const SignedUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  publicUrl: z.string().url(),
  filename: z.string(),
  expiresAt: z.string().datetime(),
})

export class SignedUrlResponseDto extends createZodDto(SignedUrlResponseSchema) {}

// List Files Response DTO
export const ListFilesResponseSchema = z.object({
  files: z.array(
    z.object({
      name: z.string(),
      url: z.string().url(),
      size: z.number().optional(),
      contentType: z.string().optional(),
      createdAt: z.string().datetime().optional(),
    })
  ),
  nextPageToken: z.string().optional(),
})

export class ListFilesResponseDto extends createZodDto(ListFilesResponseSchema) {}

export type UploadResponse = z.infer<typeof UploadResponseSchema>
export type SignedUrlRequest = z.infer<typeof SignedUrlRequestSchema>
export type SignedUrlResponse = z.infer<typeof SignedUrlResponseSchema>
export type ListFilesResponse = z.infer<typeof ListFilesResponseSchema>
