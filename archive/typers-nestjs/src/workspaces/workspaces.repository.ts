import { ConflictException, Injectable } from '@nestjs/common';
import { ProjectDto, ProjectStatus, TaskStatus } from './workspaces.dto.js';

export const WORKSPACES_REPOSITORY = Symbol('WORKSPACES_REPOSITORY');

export interface WorkspacesRepository {
  findAll(): Promise<ProjectDto[]>;
  findById(id: string): Promise<ProjectDto | undefined>;
  save(project: ProjectDto): Promise<ProjectDto>;
  remove(id: string): Promise<void>;
}

@Injectable()
export class InMemoryWorkspacesRepository implements WorkspacesRepository {
  private readonly projects = new Map<string, ProjectDto>();

  constructor() {
    const id = '00000000-0000-4000-8000-000000000010';
    const now = new Date();
    this.projects.set(id, {
      id,
      name: 'Typers playground',
      slug: 'typers-playground',
      description:
        'Seeded project for exploring NestJS APIs and DTO contracts.',
      status: ProjectStatus.Active,
      ownerId: '00000000-0000-4000-8000-000000000001',
      labels: ['nestjs', 'typers'],
      createdAt: now,
      updatedAt: now,
      tasks: [
        {
          id: '00000000-0000-4000-8000-000000000011',
          projectId: id,
          title: 'Inspect the OpenAPI schema',
          status: TaskStatus.Todo,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  }

  findAll(): Promise<ProjectDto[]> {
    return Promise.resolve(structuredClone([...this.projects.values()]));
  }

  findById(id: string): Promise<ProjectDto | undefined> {
    return Promise.resolve(structuredClone(this.projects.get(id)));
  }

  save(project: ProjectDto): Promise<ProjectDto> {
    if (
      [...this.projects.values()].some(
        (other) => other.id !== project.id && other.slug === project.slug,
      )
    ) {
      throw new ConflictException('A project with this slug already exists');
    }
    this.projects.set(project.id, structuredClone(project));
    return Promise.resolve(structuredClone(project));
  }

  remove(id: string): Promise<void> {
    this.projects.delete(id);
    return Promise.resolve();
  }
}
