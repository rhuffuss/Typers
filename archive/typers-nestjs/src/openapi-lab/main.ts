import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiSecurity,
  DocumentBuilder,
  PartialType,
  SwaggerModule,
  getSchemaPath,
} from '@nestjs/swagger';
import { CatalogEntryDto } from './catalog.dto.js';

export class UpdateCatalogDto extends PartialType(CatalogEntryDto) {}

@Controller('catalog')
@ApiExtraModels(CatalogEntryDto, UpdateCatalogDto)
class CatalogController {
  @Post()
  @ApiSecurity('apiKey')
  @ApiCreatedResponse({ type: CatalogEntryDto })
  create(@Body() input: CatalogEntryDto): CatalogEntryDto {
    return input;
  }

  @Get()
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { $ref: getSchemaPath(CatalogEntryDto) },
        },
        count: { type: 'integer' },
      },
    },
  })
  list() {
    return { items: [], count: 0 };
  }
}

@Module({ controllers: [CatalogController] })
class OpenApiLabModule {}

const app = await NestFactory.create(OpenApiLabModule, { logger: false });
try {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CLI plugin fixture')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'apiKey')
      .build(),
  );
  process.stdout.write(`${JSON.stringify(document)}\n`);
} finally {
  await app.close();
}
