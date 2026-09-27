import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { PubSub } from 'graphql-subscriptions';
import { Article, ArticleState, Author, SlugValue } from './graphql.models.js';
import type {
  CreateArticleInput,
  UpdateArticleInput,
} from './graphql.models.js';

@Injectable()
export class EditorialService {
  readonly authors: Author[] = [
    Object.assign(new Author(), {
      id: 'a1',
      name: ' Ada ',
      editorialNote: 'Draft reviewer',
    }),
    Object.assign(new Author(), { id: 'a2', name: 'Grace' }),
  ];
  readonly articles: Article[] = [
    Object.assign(new Article(), {
      id: 'p1',
      title: 'Nest architecture',
      authorId: 'a1',
      state: ArticleState.PUBLISHED,
      slug: new SlugValue('nest-architecture'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  ];
  private readonly emitter = new EventEmitter();
  readonly pubsub = new PubSub<{ articleAdded: { articleAdded: Article } }>({
    eventEmitter: this.emitter,
  });
  get subscriptionListeners() {
    return this.emitter.listenerCount('articleAdded');
  }
  author(id: string): Author {
    const author = this.authors.find((item) => item.id === id);
    if (!author) throw new NotFoundException('Author not found');
    return author;
  }
  async create(input: CreateArticleInput): Promise<Article> {
    this.author(input.authorId);
    const article = Object.assign(new Article(), input, {
      id: 'p' + (this.articles.length + 1),
      slug: new SlugValue(
        input.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'article',
      ),
      createdAt: new Date(),
    });
    this.articles.push(article);
    await this.pubsub.publish('articleAdded', { articleAdded: article });
    return article;
  }
  update(input: UpdateArticleInput): Article {
    const article = this.articles.find((item) => item.id === input.id);
    if (!article) throw new NotFoundException('Article not found');
    if (input.title !== undefined) article.title = input.title;
    if (input.state !== undefined) article.state = input.state;
    return article;
  }
}
