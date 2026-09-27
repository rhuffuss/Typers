import { Module } from '@nestjs/common';
import { Command, CommandFactory, CommandRunner, Option } from 'nest-commander';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

@Command({
  name: 'projects',
  description: 'Read demo projects without starting HTTP',
})
class ProjectsCommand extends CommandRunner {
  constructor(private readonly workspaces: WorkspacesService) {
    super();
  }

  async run(_inputs: string[], options: { limit?: number }) {
    const projects = await this.workspaces.listProjects({
      page: 1,
      limit: options.limit ?? 10,
    });
    process.stdout.write(`${JSON.stringify(projects)}\n`);
  }

  @Option({
    flags: '-l, --limit <number>',
    description: 'Maximum projects (1..100)',
  })
  parseLimit(value: string) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > 100)
      throw new Error('limit must be an integer from 1 to 100');
    return number;
  }
}

@Module({ imports: [WorkspacesModule], providers: [ProjectsCommand] })
class CommanderLabModule {}
await CommandFactory.run(CommanderLabModule, { logger: false });
