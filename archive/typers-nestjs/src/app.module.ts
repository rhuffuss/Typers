import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { fileURLToPath } from 'node:url';
import { FundamentalsModule } from './fundamentals/fundamentals.module.js';
import { TechniquesModule } from './techniques/techniques.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { GraphqlLabModule } from './graphql-lab/graphql-lab.module.js';
import { HealthController } from './platform/health.controller.js';
import { validateEnvironment } from './platform/configuration.js';
import { RateLimitController } from './platform/rate-limit.controller.js';
import { BusinessModule } from './business/business.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TerminusModule,
    ThrottlerModule.forRoot([{ ttl: 10000, limit: 2 }]),
    ServeStaticModule.forRoot({
      rootPath: fileURLToPath(new URL('./public', import.meta.url)),
      serveRoot: '/static',
    }),
    FundamentalsModule,
    TechniquesModule,
    WorkspacesModule,
    GraphqlLabModule,
    BusinessModule,
  ],
  controllers: [AppController, HealthController, RateLimitController],
  providers: [AppService],
})
export class AppModule {}
