import { Module } from '@nestjs/common';
import { SecurityModule } from '../security/security.module.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';
import { WorkspacesPersistenceModule } from './persistence/workspaces-persistence.module.js';

@Module({
  imports: [
    SecurityModule,
    WorkspacesPersistenceModule.register({
      driver: process.env.DEMO_DATABASE === 'postgres' ? 'postgres' : 'memory',
    }),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService, WorkspacesPersistenceModule],
})
export class WorkspacesModule {}
