import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ProjectDto, TaskDto } from '../workspaces.dto.js';
import type { WorkspacesRepository } from '../workspaces.repository.js';
import { ProjectRecordEntity, TaskRecordEntity } from './workspaces.entity.js';

@Injectable()
export class TypeOrmWorkspacesRepository implements WorkspacesRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProjectRecordEntity)
    private readonly projects: Repository<ProjectRecordEntity>,
  ) {}

  async findAll(): Promise<ProjectDto[]> {
    return (
      await this.projects.find({
        relations: { tasks: true },
        order: { tasks: { createdAt: 'ASC', id: 'ASC' } },
      })
    ).map((project) => this.toDto(project));
  }

  async findById(id: string): Promise<ProjectDto | undefined> {
    const project = await this.projects.findOne({
      where: { id },
      relations: { tasks: true },
      order: { tasks: { createdAt: 'ASC', id: 'ASC' } },
    });
    return project ? this.toDto(project) : undefined;
  }

  async save(project: ProjectDto): Promise<ProjectDto> {
    try {
      // All aggregate writes use the manager supplied by the same transaction.
      await this.dataSource.transaction(async (manager) => {
        const { tasks, ...fields } = project;
        await manager.getRepository(ProjectRecordEntity).save(fields);
        await manager
          .getRepository(TaskRecordEntity)
          .delete({ projectId: project.id });
        if (tasks.length) {
          await manager.getRepository(TaskRecordEntity).insert(
            tasks.map((task) => ({
              id: task.id,
              projectId: project.id,
              title: task.title,
              status: task.status,
              createdAt: task.createdAt,
              updatedAt: task.updatedAt,
            })),
          );
        }
      });
      return structuredClone(project);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as Error & {
          code?: string;
          constraint?: string;
        };
        if (
          driverError.code === '23505' &&
          driverError.constraint === 'UQ_projects_slug'
        ) {
          throw new ConflictException(
            'A project with this slug already exists',
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    // The migration's foreign key cascades deletion of child tasks atomically.
    await this.projects.delete(id);
  }

  private toDto(project: ProjectRecordEntity): ProjectDto {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      status: project.status,
      labels: project.labels,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      tasks: project.tasks.map((task): TaskDto => ({
        id: task.id,
        projectId: task.projectId,
        title: task.title,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    };
  }
}
