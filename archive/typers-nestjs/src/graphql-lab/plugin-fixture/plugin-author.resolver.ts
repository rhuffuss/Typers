import { Query, Resolver } from '@nestjs/graphql';
import { PluginAuthor } from './plugin-author.model.js';

@Resolver(() => PluginAuthor)
export class PluginAuthorResolver {
  @Query(() => PluginAuthor)
  pluginAuthor(): PluginAuthor {
    return {
      id: 'compiler-1',
      displayName: 'Metadata',
      tags: ['nest', 'typers'],
      internalKey: 'hidden',
    };
  }
}
