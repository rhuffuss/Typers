import { repl } from '@nestjs/core';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
await repl(WorkspacesModule);
