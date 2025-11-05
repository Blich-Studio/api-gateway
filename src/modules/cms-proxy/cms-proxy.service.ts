import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CmsProxyService {
  private cmsApiUrl: string;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.cmsApiUrl =
      this.configService.get<string>('cmsApiUrl') ||
      'http://localhost:3001/api/cms';
  }

  async getAssets() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.cmsApiUrl}/Assets`),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'CMS request failed',
        error.response?.status || 500,
      );
    }
  }

  async getAssetBySlug(slug: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.cmsApiUrl}/Assets/${slug}`),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'CMS request failed',
        error.response?.status || 500,
      );
    }
  }

  async getBlogPosts() {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.cmsApiUrl}/blog`),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'CMS request failed',
        error.response?.status || 500,
      );
    }
  }

  async getBlogPost(slug: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.cmsApiUrl}/blog/${slug}`),
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'CMS request failed',
        error.response?.status || 500,
      );
    }
  }
}
