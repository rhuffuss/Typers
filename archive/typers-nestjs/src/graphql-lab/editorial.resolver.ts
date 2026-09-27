import {
  Inject,
  UseFilters,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import {
  Args,
  Context,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import {
  Article,
  ArticlePageArgs,
  ArticleTitleInput,
  Author,
  AuthorsPage,
  CreateArticleInput,
  EditorialNode,
  EditorialSearchResult,
  SlugValue,
  UpdateArticleInput,
} from './graphql.models.js';
import { EditorialService } from './editorial.service.js';
import {
  EditorialRole,
  GraphqlEditorGuard,
  GraphqlNotFoundFilter,
  GraphqlTraceInterceptor,
} from './graphql.support.js';
import type { EditorialContext } from './graphql.support.js';

const validate = new ValidationPipe({ transform: true, whitelist: true });

@Resolver(() => Author)
@UseFilters(GraphqlNotFoundFilter)
@UseInterceptors(GraphqlTraceInterceptor)
export class AuthorsResolver {
  constructor(
    @Inject(EditorialService) private readonly editorial: EditorialService,
  ) {}
  @Query(() => AuthorsPage) authorsPage() {
    return {
      items: this.editorial.authors,
      total: this.editorial.authors.length,
    };
  }
  @Query(() => String) editorialRole(@EditorialRole() role: string) {
    return role;
  }
  @Query(() => [Author]) authors() {
    return this.editorial.authors;
  }
  @Query(() => Author) author(@Args('id') id: string) {
    return this.editorial.author(id);
  }
  @ResolveField(() => [Article]) articles(@Parent() author: Author) {
    return this.editorial.articles.filter(
      (article) => article.authorId === author.id,
    );
  }
  @Query(() => [EditorialSearchResult]) editorialSearch() {
    return [...this.editorial.authors, ...this.editorial.articles];
  }
  @Query(() => EditorialNode) editorialNode(@Args('id') id: string) {
    return (
      this.editorial.articles.find((article) => article.id === id) ??
      this.editorial.author(id)
    );
  }
  @Query(() => String) editorialContext(
    @Context() context: EditorialContext,
    @Info() info: GraphQLResolveInfo,
  ) {
    return `${info.fieldName}:${context.role ?? 'reader'}`;
  }
}

@Resolver(() => Article)
@UseFilters(GraphqlNotFoundFilter)
@UseInterceptors(GraphqlTraceInterceptor)
export class ArticlesResolver {
  constructor(
    @Inject(EditorialService) private readonly editorial: EditorialService,
  ) {}
  @Query(() => [Article], {
    complexity: ({
      args,
      childComplexity,
    }: {
      args: { limit?: number };
      childComplexity: number;
    }) => (args.limit ?? 10) * childComplexity,
  })
  articles(@Args(validate) page: ArticlePageArgs) {
    return this.editorial.articles.slice(page.offset, page.offset + page.limit);
  }
  @ResolveField(() => Author) author(@Parent() article: Article) {
    return this.editorial.author(article.authorId);
  }
  @Mutation(() => Article)
  @UseGuards(GraphqlEditorGuard)
  createArticle(@Args('input', validate) input: CreateArticleInput) {
    return this.editorial.create(input);
  }
  @Mutation(() => Article)
  @UseGuards(GraphqlEditorGuard)
  updateArticle(@Args('input', validate) input: UpdateArticleInput) {
    return this.editorial.update(input);
  }
  @Query(() => String) previewArticleTitle(
    @Args('input', validate) input: ArticleTitleInput,
  ) {
    return input.title;
  }
  @Query(() => SlugValue) echoSlug(
    @Args('value', { type: () => SlugValue }) value: SlugValue,
  ) {
    return value;
  }
  @Subscription(() => Article, {
    filter: (
      payload: { articleAdded: Article },
      variables: { authorId?: string },
    ) =>
      !variables.authorId ||
      payload.articleAdded.authorId === variables.authorId,
    resolve: (payload: { articleAdded: Article }) => payload.articleAdded,
  })
  articleAdded(
    @Args('authorId', { type: () => String, nullable: true })
    _authorId?: string,
  ) {
    return this.editorial.pubsub.asyncIterableIterator('articleAdded');
  }
}
