import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UploadsService, type FileMetadata } from './uploads.service'
import { SignedUrlRequestDto } from './dto/upload.dto'

interface AuthUser {
  userId: string
  email: string
}

interface MulterFile {
  buffer: Buffer
  originalname: string
  mimetype: string
}

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('signed-url')
  @Roles('writer', 'admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get a signed URL for direct upload (writer/admin only)' })
  @ApiResponse({ status: 200, description: 'Returns signed upload URL' })
  @ApiResponse({ status: 403, description: 'Forbidden - writer/admin only' })
  async getSignedUrl(@Body() dto: SignedUrlRequestDto, @CurrentUser() user: AuthUser) {
    return this.uploadsService.generateSignedUploadUrl(dto, user.userId)
  }

  @Post('file')
  @Roles('writer', 'admin')
  @UseGuards(RolesGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file directly (writer/admin only)' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - writer/admin only' })
  @ApiResponse({ status: 413, description: 'File too large' })
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /^(image|video|application\/pdf)/ }),
        ],
      })
    )
    file: MulterFile,
    @Query('folder') folder = 'general',
    @CurrentUser() user: AuthUser
  ) {
    return this.uploadsService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
      user.userId
    )
  }

  @Get('files/:folder')
  @Roles('writer', 'admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'List files in a folder (writer/admin only)' })
  @ApiResponse({ status: 200, description: 'Returns list of files' })
  async listFiles(
    @Param('folder') folder: string,
    @Query('pageToken') pageToken?: string,
    @Query('limit') limit?: number
  ): Promise<{ files: FileMetadata[]; nextPageToken?: string }> {
    return this.uploadsService.listFiles(folder, pageToken, limit)
  }

  @Delete(':path')
  @Roles('admin')
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete a file (admin only)' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('path') path: string) {
    await this.uploadsService.deleteFile(path)
    return { message: 'File deleted successfully' }
  }
}
