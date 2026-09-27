import { NestFactory } from '@nestjs/core';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const context = await NestFactory.createApplicationContext(WorkspacesModule, {
  logger: false,
});
try {
  const projects = await context
    .get(WorkspacesService)
    .listProjects({ page: 1, limit: 10 });
  process.stdout.write(`${JSON.stringify({ kind: 'standalone', projects })}\n`);
} finally {
  await context.close();
}
