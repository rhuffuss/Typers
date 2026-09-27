import {
  Directive,
  Extensions,
  Field,
  ID,
  InputType,
  Int,
  InterfaceType,
  IntersectionType,
  ObjectType,
  OmitType,
  PartialType,
  PickType,
  registerEnumType,
  createUnionType,
  ArgsType,
} from '@nestjs/graphql';
import type { Type } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { requireEditorField, trimField } from './graphql.support.js';

export enum ArticleState {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}
registerEnumType(ArticleState, {
  name: 'ArticleState',
  description: 'Estado editorial del artículo.',
});

export { SlugValue } from './slug.value.js';
import { SlugValue } from './slug.value.js';

@InterfaceType({
  resolveType: (value: { title?: string }) =>
    value.title === undefined ? Author : Article,
})
export abstract class EditorialNode {
  @Field(() => ID) id: string;
}

@ObjectType({ implements: () => [EditorialNode] })
export class Author implements EditorialNode {
  @ApiProperty({ example: 'a1' })
  @Field(() => ID)
  id: string;

  @ApiProperty({ example: 'Ada' })
  @Field(() => String, { middleware: [trimField] })
  name: string;

  @Extensions({ role: 'editor' })
  @Field(() => String, { nullable: true, middleware: [requireEditorField] })
  editorialNote?: string;
}

@ObjectType({ implements: () => [EditorialNode] })
export class Article implements EditorialNode {
  @Field(() => ID) id: string;

  @Directive('@upper')
  @Field(() => String, { complexity: 2 })
  title: string;

  @Field(() => ID) authorId: string;
  @Field(() => ArticleState) state: ArticleState;
  @Field(() => SlugValue) slug: SlugValue;
  @Field(() => Date) createdAt: Date;
}

export const EditorialSearchResult = createUnionType({
  name: 'EditorialSearchResult',
  types: () => [Author, Article] as const,
  resolveType: (value: { title?: string }) =>
    value.title === undefined ? Author : Article,
});

@InputType()
export class CreateArticleInput {
  @Field(() => String)
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title: string;

  @Field(() => ID)
  @IsString()
  @MinLength(1)
  authorId: string;

  @Field(() => ArticleState, { defaultValue: ArticleState.DRAFT })
  @IsEnum(ArticleState)
  state: ArticleState;
}

@InputType()
export class ArticleIdInput {
  @Field(() => ID) @IsString() id: string;
}

@InputType()
export class ArticleTitleInput extends PickType(CreateArticleInput, [
  'title',
] as const) {}

@InputType()
export class ArticleContentInput extends OmitType(CreateArticleInput, [
  'authorId',
  'state',
] as const) {
  @Field(() => ArticleState, { nullable: true })
  @IsOptional()
  @IsEnum(ArticleState)
  state?: ArticleState;
}

@InputType()
export class UpdateArticleInput extends IntersectionType(
  ArticleIdInput,
  PartialType(ArticleContentInput),
) {}

@ArgsType()
export class ArticlePageArgs {
  @Field(() => Int, { defaultValue: 0 })
  @IsInt()
  @Min(0)
  offset = 0;

  @Field(() => Int, { defaultValue: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}
export function Paginated<T>(classRef: Type<T>): Type<PageResult<T>> {
  @ObjectType({ isAbstract: true })
  class PaginatedType implements PageResult<T> {
    @Field(() => [classRef]) items: T[];
    @Field(() => Int) total: number;
  }
  return PaginatedType;
}

@ObjectType()
export class AuthorsPage extends Paginated(Author) {}
