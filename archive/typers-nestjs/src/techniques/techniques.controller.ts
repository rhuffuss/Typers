import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Inject,
  Param,
  ParseArrayPipe,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseFilePipeBuilder,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  RawBody,
  Render,
  Req,
  Res,
  SerializeOptions,
  Sse,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  Version,
  UseFilters,
  NotFoundException,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import {
  CACHE_MANAGER,
  CacheInterceptor,
  CacheTTL,
} from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { firstValueFrom, interval, map, take } from 'rxjs';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  ActivityLog,
  ActivityRequestedEvent,
  ReadActivityQuery,
  RecordActivityCommand,
} from './activity.js';
import { RequestContext } from './request-context.js';
import { HttpErrorFilter } from '../platform/http-error.filter.js';

enum Mode {
  compact = 'compact',
  detailed = 'detailed',
}
const messageSchema = z.object({ message: z.string().min(1).max(200) });

@ApiTags('techniques')
@Controller('techniques')
@UseFilters(HttpErrorFilter)
export class TechniquesController {
  private computations = 0;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly http: HttpService,
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly events: EventBus,
    private readonly log: ActivityLog,
    private readonly context: RequestContext,
    private readonly config: ConfigService,
  ) {}

  @Get('errors/:kind')
  errors(@Param('kind') kind: string): never {
    if (kind === 'missing')
      throw new NotFoundException('Demonstration resource not found');
    throw new Error(
      'Internal detail that must not appear in the HTTP response',
    );
  }

  @Get('pipes/:id')
  pipes(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('active', new DefaultValuePipe(true), ParseBoolPipe) active: boolean,
    @Query(
      'ids',
      new DefaultValuePipe('1,2'),
      new ParseArrayPipe({ items: Number, separator: ',' }),
    )
    ids: number[],
    @Query('mode', new DefaultValuePipe(Mode.compact), new ParseEnumPipe(Mode))
    mode: Mode,
  ) {
    return { id, page, active, ids, mode };
  }

  @Post('schema')
  @UsePipes(StandardSchemaValidationPipe)
  @UseInterceptors(StandardSchemaSerializerInterceptor)
  @SerializeOptions({ schema: messageSchema })
  schema(@Body({ schema: messageSchema }) body: z.infer<typeof messageSchema>) {
    return { ...body, internalOnly: 'removed by response schema' };
  }

  @Get('cache')
  @CacheTTL(1000)
  @UseInterceptors(CacheInterceptor)
  cached() {
    return { computation: ++this.computations };
  }

  @Post('cache/reset')
  async resetCache() {
    await this.cache.clear();
    return { cleared: true };
  }

  @Post('activity')
  @UsePipes(StandardSchemaValidationPipe)
  async activity(
    @Body({ schema: messageSchema }) body: z.infer<typeof messageSchema>,
  ) {
    return {
      count: await this.commands.execute(
        new RecordActivityCommand(body.message),
      ),
    };
  }

  @Post('saga')
  @UsePipes(StandardSchemaValidationPipe)
  saga(@Body({ schema: messageSchema }) body: z.infer<typeof messageSchema>) {
    this.events.publish(new ActivityRequestedEvent(body.message));
    return { accepted: true };
  }

  @Get('activity')
  activityLog() {
    return this.queries.execute(new ReadActivityQuery());
  }

  @Get('schedule')
  schedule() {
    return { ticks: this.log.ticks, intervalMs: 60000 };
  }

  @Get('context')
  async requestContext() {
    await Promise.resolve();
    return { requestId: this.context.requestId };
  }

  @Get('http')
  @ApiOperation({
    summary:
      'Calls a configured upstream through HttpModule (set DEMO_UPSTREAM_URL)',
  })
  async upstream() {
    const url = this.config.get<string>('DEMO_UPSTREAM_URL');
    if (!url) return { configured: false };
    const response = await firstValueFrom(
      this.http.get<unknown>(url, { timeout: 1500 }),
    );
    return { status: response.status, data: response.data };
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 64 * 1024 } }))
  upload(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 64 * 1024 })
        .build(),
    )
    file: Express.Multer.File,
  ) {
    return {
      name: file.originalname,
      size: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
    };
  }

  @Get('download')
  download() {
    return new StreamableFile(Buffer.from('id,title\n1,Typers NestJS\n'), {
      type: 'text/csv',
      disposition: 'attachment; filename="projects.csv"',
    });
  }

  @Sse('events')
  serverSentEvents() {
    return interval(20).pipe(
      take(3),
      map((index): MessageEvent => ({
        id: String(index),
        type: 'tick',
        data: { index },
      })),
    );
  }

  @Get('cookies')
  cookies(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const previous = req.cookies?.['demo-theme'] as unknown;
    res.cookie('demo-theme', 'dark', { httpOnly: true, sameSite: 'lax' });
    return { previous: typeof previous === 'string' ? previous : null };
  }

  @Get('session')
  session(@Req() req: Request) {
    const session = req.session as typeof req.session & { visits?: number };
    session.visits = (session.visits ?? 0) + 1;
    return { visits: session.visits };
  }

  @Post('raw-body')
  raw(@RawBody() rawBody: Buffer | undefined) {
    return {
      bytes: rawBody?.length,
      sha256: createHash('sha256')
        .update(rawBody ?? '')
        .digest('hex'),
    };
  }

  @Get('view')
  @Render('index')
  view() {
    return {
      title: 'Typers NestJS',
      message: 'MVC renderizado por Nest y Handlebars',
    };
  }

  @Version('1')
  @Get('version')
  v1() {
    return { version: 1 };
  }

  @Version('2')
  @Get('version')
  v2() {
    return { version: 2 };
  }
}
