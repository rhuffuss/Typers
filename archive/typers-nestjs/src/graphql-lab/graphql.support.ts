import {
  Catch,
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ArgumentsHost,
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { GqlArgumentsHost, GqlExecutionContext, Scalar } from '@nestjs/graphql';
import type {
  CustomScalar,
  FieldMiddleware,
  GqlExceptionFilter,
} from '@nestjs/graphql';
import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLError,
  Kind,
  defaultFieldResolver,
} from 'graphql';
import type { GraphQLSchema, ValueNode } from 'graphql';
import { getDirective, mapSchema, MapperKind } from '@graphql-tools/utils';
import { tap } from 'rxjs';
import { SlugValue } from './slug.value.js';

export interface EditorialContext {
  role?: string;
  req?: { headers: Record<string, string | string[] | undefined> };
}

export const EditorialRole = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    GqlExecutionContext.create(context).getContext<EditorialContext>().role ??
    'reader',
);

export const trimField: FieldMiddleware = async (_context, next) => {
  const value: unknown = await next();
  return typeof value === 'string' ? value.trim() : value;
};

export const requireEditorField: FieldMiddleware = (context, next) => {
  const info = context.info;
  if (!info) throw new GraphQLError('GraphQL field metadata unavailable');
  const requiredRole =
    info.parentType.getFields()[info.fieldName]?.extensions.role;
  if (requiredRole !== (context.context as EditorialContext).role) {
    throw new GraphQLError('Editorial field requires editor role', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return next();
};

export const upperDirective = new GraphQLDirective({
  name: 'upper',
  locations: [DirectiveLocation.FIELD_DEFINITION],
});
export function applyUpperDirective(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (field) => {
      if (!getDirective(schema, field, 'upper')?.length) return field;
      const resolve = field.resolve ?? defaultFieldResolver;
      field.resolve = async (source, args, context, info) => {
        const value: unknown = await resolve(source, args, context, info);
        return typeof value === 'string' ? value.toUpperCase() : value;
      };
      return field;
    },
  });
}

@Scalar('Slug', () => SlugValue)
export class SlugScalar implements CustomScalar<string, SlugValue> {
  description = 'Lowercase words separated with hyphens.';
  parseValue(value: unknown): SlugValue {
    if (
      typeof value !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
    ) {
      throw new GraphQLError(
        'Slug must contain lowercase words separated with hyphens',
      );
    }
    return new SlugValue(value);
  }
  serialize(value: unknown): string {
    if (!(value instanceof SlugValue))
      throw new GraphQLError('Invalid Slug output');
    return value.value;
  }
  parseLiteral(ast: ValueNode): SlugValue {
    if (ast.kind !== Kind.STRING)
      throw new GraphQLError('Slug literal must be a string');
    return this.parseValue(ast.value);
  }
}

@Injectable()
export class GraphqlEditorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (
      GqlExecutionContext.create(context).getContext<EditorialContext>()
        .role !== 'editor'
    ) {
      throw new ForbiddenException('Editor role required');
    }
    return true;
  }
}

@Injectable()
export class GraphqlTrace {
  readonly calls: string[] = [];
}

@Injectable()
export class GraphqlTraceInterceptor implements NestInterceptor {
  constructor(@Inject(GraphqlTrace) private readonly trace: GraphqlTrace) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const name = GqlExecutionContext.create(context).getInfo<{
      fieldName: string;
    }>().fieldName;
    this.trace.calls.push('before:' + name);
    return next
      .handle()
      .pipe(tap(() => this.trace.calls.push('after:' + name)));
  }
}

@Catch(NotFoundException)
export class GraphqlNotFoundFilter implements GqlExceptionFilter {
  catch(error: NotFoundException, host: ArgumentsHost) {
    const field = GqlArgumentsHost.create(host).getInfo<{ fieldName: string }>()
      .fieldName;
    return new GraphQLError(error.message, {
      extensions: { code: 'EDITORIAL_NOT_FOUND', field },
    });
  }
}
