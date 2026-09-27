import { Field, HideField, ID, ObjectType } from '@nestjs/graphql';

/** This fixture intentionally relies on the real Nest compiler plugin. */
@ObjectType()
export class PluginAuthor {
  @Field(() => ID) id: string;
  /** Display name inferred by the GraphQL CLI plugin. */
  displayName: string;
  biography?: string;
  tags: string[];
  @HideField() internalKey: string;
}
