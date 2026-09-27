import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { readFile } from 'node:fs/promises';

@ApiTags('Aplicación')
@Controller('policy')
export class PolicyController {
  @Get()
  @ApiOperation({
    summary:
      'Consultar la política incluida como asset por el adaptador de build',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        currency: { type: 'string', enum: ['EUR'] },
        coupons: {
          type: 'object',
          properties: {
            SAVE10: { type: 'integer', example: 10 },
            ZERO: { type: 'integer', example: 0 },
          },
        },
        storage: { type: 'string', example: 'in-memory' },
        payments: { type: 'boolean', example: false },
      },
    },
  })
  async policy(): Promise<unknown> {
    // Relative to emitted JS: this request fails if the build omitted its asset.
    const contents = await readFile(
      new URL('../assets/policy.json', import.meta.url),
      'utf8',
    );
    return JSON.parse(contents) as unknown;
  }
}
