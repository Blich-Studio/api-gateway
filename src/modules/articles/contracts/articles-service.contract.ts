import type { Article } from '../models/article.model'

export interface ArticlesServiceContract {
  findAll(): Promise<Article[]>
  findOne(id: string): Promise<Article>
}

export const ARTICLES_SERVICE = Symbol('ARTICLES_SERVICE')
