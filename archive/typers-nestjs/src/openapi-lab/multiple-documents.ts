import {
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
  DocumentBuilder,
  getSchemaPath,
  SwaggerModule,
} from '@nestjs/swagger';

export class PublicationDto {
  @ApiProperty({ example: 'nest-reference' })
  id: string;

  @ApiProperty({ example: 'NestJS reference' })
  title: string;
}

export class PageDto<T> {
  @ApiProperty({ type: 'integer', minimum: 0 })
  total: number;

  // Runtime metadata cannot preserve T; each response supplies the item schema.
  items: T[];
}

export class MemberDto {
  @ApiProperty({ example: 'reader' })
  handle: string;
}

const publication: PublicationDto = {
  id: 'nest-reference',
  title: 'NestJS reference',
};

@ApiTags('publications')
@ApiExtraModels(PublicationDto)
@Controller('catalog')
export class PublicationsController {
  @Get()
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(PageDto) },
        {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(PublicationDto) },
            },
          },
        },
      ],
    },
  })
  list(): PageDto<PublicationDto> {
    return { total: 1, items: [publication] };
  }

  @Get('featured')
  @ApiOkResponse({
    type: PublicationDto,
    links: {
      publicationById: {
        operationId: 'PublicationsController.findOne',
        parameters: { id: '$response.body#/id' },
      },
      relativePublication: {
        operationRef: './catalog.json#/paths/~1api~1catalog~1%7Bid%7D/get',
        parameters: { id: '$response.body#/id' },
      },
    },
  })
  featured(): PublicationDto {
    return publication;
  }

  @Get(':id')
  @ApiOkResponse({ type: PublicationDto })
  @ApiNotFoundResponse({ description: 'Publication does not exist' })
  findOne(@Param('id') id: string): PublicationDto {
    if (id !== publication.id)
      throw new NotFoundException('Publication does not exist');
    return publication;
  }
}

@ApiTags('revisions')
@Controller('revisions')
export class RevisionsController {
  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { revision: { type: 'integer' } },
      required: ['revision'],
    },
  })
  current() {
    return { revision: 1 };
  }
}

@Module({ controllers: [RevisionsController] })
export class RevisionsDocumentsModule {}

@Module({
  imports: [RevisionsDocumentsModule],
  controllers: [PublicationsController],
})
export class CatalogDocumentsModule {}

@ApiTags('members')
@Controller('members')
export class MembersController {
  @Get()
  @ApiOkResponse({ type: MemberDto, isArray: true })
  list(): MemberDto[] {
    return [{ handle: 'reader' }];
  }
}

@Module({ controllers: [MembersController] })
export class MembersDocumentsModule {}

@Module({ imports: [CatalogDocumentsModule, MembersDocumentsModule] })
export class MultipleDocumentsModule {}

export async function createMultipleDocumentsLab() {
  const app = await NestFactory.create<NestExpressApplication>(
    MultipleDocumentsModule,
    { logger: false },
  );
  try {
    app.setGlobalPrefix('api');
    const catalogConfig = new DocumentBuilder()
      .setTitle('Publication catalog')
      .setVersion('1.0')
      .build();
    const catalogOptions = {
      include: [CatalogDocumentsModule],
      extraModels: [PageDto],
      operationIdFactory: (controller: string, method: string) =>
        `${controller}.${method}`,
    };
    const catalog = SwaggerModule.createDocument(app, catalogConfig, {
      ...catalogOptions,
      deepScanRoutes: true,
    });
    const shallowCatalog = SwaggerModule.createDocument(app, catalogConfig, {
      ...catalogOptions,
      deepScanRoutes: false,
    });
    const members = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Members directory')
        .setVersion('1.0')
        .build(),
      { include: [MembersDocumentsModule], deepScanRoutes: false },
    );
    SwaggerModule.setup('docs/catalog', app, catalog, {
      jsonDocumentUrl: '/specs/catalog.json',
    });
    SwaggerModule.setup('docs/members', app, members, {
      jsonDocumentUrl: '/specs/members.json',
    });
    SwaggerModule.setup('docs', app, catalog, {
      explorer: true,
      raw: false,
      swaggerOptions: {
        urls: [
          { name: 'Catalog', url: '/specs/catalog.json' },
          { name: 'Members', url: '/specs/members.json' },
        ],
      },
    });
    await app.init();
    return { app, catalog, shallowCatalog, members };
  } catch (error) {
    await app.close();
    throw error;
  }
}
