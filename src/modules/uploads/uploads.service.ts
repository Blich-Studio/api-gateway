import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Storage, Bucket } from '@google-cloud/storage'
import { randomUUID } from 'node:crypto'
import { AppConfigService } from '../../common/config'
import type { SignedUrlRequest, UploadResponse, SignedUrlResponse } from './dto/upload.dto'

export interface FileMetadata {
  name: string
  url: string
  size?: number
  contentType?: string
  createdAt?: string
}

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name)
  private storage: Storage
  private bucket: Bucket
  private bucketName: string
  private publicUrl: string

  constructor(private readonly appConfig: AppConfigService) {
    this.bucketName = this.appConfig.gcsBucketName
    this.publicUrl = this.appConfig.gcsPublicUrl
  }

  async onModuleInit() {
    try {
      // Initialize Google Cloud Storage
      // In production, uses Application Default Credentials (ADC)
      // For local development, set GOOGLE_APPLICATION_CREDENTIALS env var
      const projectId = this.appConfig.gcpProjectId
      const keyFile = this.appConfig.googleApplicationCredentials
      const apiEndpoint = this.appConfig.gcsApiEndpoint

      const storageConfig: ConstructorParameters<typeof Storage>[0] = {}
      if (projectId) storageConfig.projectId = projectId
      if (keyFile) storageConfig.keyFilename = keyFile

      // If an emulator or custom API endpoint is provided, set apiEndpoint so the client talks to it
      if (apiEndpoint) {
        storageConfig.apiEndpoint = apiEndpoint
        // Fake GCS servers often run over plain HTTP and do not use TLS
        // The client will infer the scheme from the apiEndpoint
        this.logger.log(`Using custom GCS API endpoint: ${apiEndpoint}`)
      }

      this.storage = new Storage(storageConfig)
      this.bucket = this.storage.bucket(this.bucketName)

      // Verify bucket exists
      const [exists] = await this.bucket.exists()
      if (!exists) {
        this.logger.warn(`Bucket ${this.bucketName} does not exist. Creating...`)
        await this.createBucket()
      } else {
        this.logger.log(`Connected to GCS bucket: ${this.bucketName}`)
        // Verify bucket is publicly readable
        await this.verifyPublicAccess()
      }
    } catch (error) {
      this.logger.error('Failed to initialize GCS storage', error)
      // Don't throw - allow app to start, uploads will fail gracefully
    }
  }

  private async createBucket() {
    try {
      const projectId = this.appConfig.gcpProjectId
      const location = this.appConfig.gcsBucketLocation

      await this.storage.createBucket(this.bucketName, {
        location,
        ...(projectId && { projectId }),
        publicAccessPrevention: 'unspecified',
        uniformBucketLevelAccess: { enabled: true },
      })

      // Make bucket publicly readable for serving images
      // This sets allUsers as Reader role
      await this.bucket.iam.setPolicy({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['allUsers'],
          },
        ],
      })

      this.logger.log(`Created bucket ${this.bucketName} and made it public`)
    } catch (error) {
      this.logger.error(`Failed to create bucket ${this.bucketName}`, error)
      throw error
    }
  }

  private async verifyPublicAccess() {
    try {
      const [policy] = await this.bucket.iam.getPolicy()
      const isPublic = policy.bindings.some(
        binding =>
          binding.role === 'roles/storage.objectViewer' && binding.members.includes('allUsers')
      )

      if (!isPublic) {
        this.logger.warn(`Bucket ${this.bucketName} is not publicly readable. Making it public...`)
        // Add allUsers as object viewer
        const currentPolicy = policy
        const existingBinding = currentPolicy.bindings.find(
          b => b.role === 'roles/storage.objectViewer'
        )
        if (existingBinding) {
          if (!existingBinding.members.includes('allUsers')) {
            existingBinding.members.push('allUsers')
          }
        } else {
          currentPolicy.bindings.push({
            role: 'roles/storage.objectViewer',
            members: ['allUsers'],
          })
        }

        await this.bucket.iam.setPolicy(currentPolicy)
        this.logger.log(`Made bucket ${this.bucketName} publicly readable`)
      } else {
        this.logger.log(`Bucket ${this.bucketName} is publicly readable`)
      }
    } catch (error) {
      this.logger.error(`Failed to verify/set public access for bucket ${this.bucketName}`, error)
      // Don't throw - warn but continue
    }
  }

  /**
   * Generate a signed URL for direct upload from client
   */
  async generateSignedUploadUrl(
    request: SignedUrlRequest,
    userId: string
  ): Promise<SignedUrlResponse> {
    const { filename, contentType, folder } = request

    // Generate unique filename to prevent collisions
    const extension = filename.split('.').pop() ?? ''
    const uniqueFilename = `${randomUUID()}.${extension}`
    const path = `${folder}/${uniqueFilename}`

    const file = this.bucket.file(path)

    // Generate signed URL for upload (expires in 15 minutes)
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
      extensionHeaders: {
        'x-goog-content-length-range': '0,10485760', // Max 10MB
      },
    })

    const publicUrl = `${this.publicUrl}/${path}`
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    this.logger.log(`Generated signed upload URL for user ${userId}: ${path}`)

    return {
      uploadUrl,
      publicUrl,
      filename: uniqueFilename,
      expiresAt,
    }
  }

  /**
   * Upload a file directly (for server-side uploads)
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalFilename: string,
    contentType: string,
    folder = 'general',
    userId: string
  ): Promise<UploadResponse> {
    // Generate unique filename
    const extension = originalFilename.split('.').pop() ?? ''
    const uniqueFilename = `${randomUUID()}.${extension}`
    const path = `${folder}/${uniqueFilename}`

    const file = this.bucket.file(path)

    try {
      await file.save(fileBuffer, {
        metadata: {
          contentType,
          metadata: {
            uploadedBy: userId,
            originalFilename,
          },
        },
      })
    } catch (error) {
      this.logger.error(`Failed to upload file: ${path}`, error)
      throw error
    }

    const publicUrl = `${this.publicUrl}/${path}`

    this.logger.log(`Uploaded file for user ${userId}: ${path}`)

    return {
      url: publicUrl,
      filename: uniqueFilename,
      contentType,
      size: fileBuffer.length,
      bucket: this.bucketName,
      path,
      uploadedAt: new Date().toISOString(),
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const file = this.bucket.file(path)
      await file.delete()
      this.logger.log(`Deleted file: ${path}`)
    } catch (error) {
      this.logger.error(`Failed to delete file: ${path}`, error)
      throw error
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(
    folder: string,
    pageToken?: string,
    limit = 50
  ): Promise<{ files: FileMetadata[]; nextPageToken?: string }> {
    const [files, , metadata] = await this.bucket.getFiles({
      prefix: `${folder}/`,
      maxResults: limit,
      pageToken,
    })

    const fileList: FileMetadata[] = await Promise.all(
      files.map(async file => {
        const [fileMetadata] = await file.getMetadata()
        return {
          name: file.name.replace(`${folder}/`, ''),
          url: `${this.publicUrl}/${file.name}`,
          size: fileMetadata.size ? Number(fileMetadata.size) : undefined,
          contentType: fileMetadata.contentType ?? undefined,
          createdAt: fileMetadata.timeCreated ?? undefined,
        }
      })
    )

    return {
      files: fileList,
      nextPageToken: (metadata as { nextPageToken?: string } | undefined)?.nextPageToken,
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<FileMetadata | null> {
    try {
      const file = this.bucket.file(path)
      const [metadata] = await file.getMetadata()

      return {
        name: path.split('/').pop() ?? path,
        url: `${this.publicUrl}/${path}`,
        size: metadata.size ? Number(metadata.size) : undefined,
        contentType: metadata.contentType ?? undefined,
        createdAt: metadata.timeCreated ?? undefined,
      }
    } catch {
      return null
    }
  }
}
