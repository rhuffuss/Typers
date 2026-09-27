import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateProjectDto,
  CreateTaskDto,
  ProjectDto,
  ProjectPageDto,
  ProjectQueryDto,
  ProjectStatus,
  TaskDto,
  TaskStatus,
  UpdateProjectDto,
  UpdateTaskDto,
} from './workspaces.dto.js';
import {
  WORKSPACES_REPOSITORY,
  type WorkspacesRepository,
} from './workspaces.repository.js';

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(WORKSPACES_REPOSITORY)
    private readonly repository: WorkspacesRepository,
  ) {}

  async listProjects(
    query: ProjectQueryDto = new ProjectQueryDto(),
  ): Promise<ProjectPageDto> {
    const search = query.search?.toLowerCase();
    const projects = (await this.repository.findAll())
      .filter((project) => !query.status || project.status === query.status)
      .filter(
        (project) =>
          !search ||
          `${project.name} ${project.slug}`.toLowerCase().includes(search),
      )
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
    return {
      items: projects.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      total: projects.length,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(projects.length / query.limit),
    };
  }

  async getProject(id: string): Promise<ProjectDto> {
    const project = await this.repository.findById(id);
    if (!project) throw new NotFoundException(`Project ${id} was not found`);
    return project;
  }

  async createProject(
    input: CreateProjectDto,
    ownerId: string,
  ): Promise<ProjectDto> {
    const now = new Date();
    return this.repository.save(
      Object.assign(new ProjectDto(), input, {
        id: randomUUID(),
        ownerId,
        description: input.description ?? '',
        status: input.status ?? ProjectStatus.Active,
        labels: input.labels ?? [],
        tasks: [],
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async updateProject(
    id: string,
    input: UpdateProjectDto,
  ): Promise<ProjectDto> {
    const project = await this.getProject(id);
    return this.repository.save(
      Object.assign(new ProjectDto(), project, input, {
        updatedAt: new Date(),
      }),
    );
  }

  async removeProject(id: string): Promise<void> {
    await this.getProject(id);
    await this.repository.remove(id);
  }

  async listTasks(projectId: string): Promise<TaskDto[]> {
    return (await this.getProject(projectId)).tasks;
  }

  async getTask(projectId: string, taskId: string): Promise<TaskDto> {
    const task = (await this.listTasks(projectId)).find(
      (item) => item.id === taskId,
    );
    if (!task)
      throw new NotFoundException(
        `Task ${taskId} was not found in project ${projectId}`,
      );
    return task;
  }

  async createTask(projectId: string, input: CreateTaskDto): Promise<TaskDto> {
    const project = await this.getProject(projectId);
    const now = new Date();
    const task = Object.assign(new TaskDto(), input, {
      id: randomUUID(),
      projectId,
      status: input.status ?? TaskStatus.Todo,
      createdAt: now,
      updatedAt: now,
    });
    project.tasks.push(task);
    project.updatedAt = now;
    await this.repository.save(project);
    return task;
  }

  async updateTask(
    projectId: string,
    taskId: string,
    input: UpdateTaskDto,
  ): Promise<TaskDto> {
    const project = await this.getProject(projectId);
    const index = project.tasks.findIndex((item) => item.id === taskId);
    if (index < 0)
      throw new NotFoundException(
        `Task ${taskId} was not found in project ${projectId}`,
      );
    const task = Object.assign(new TaskDto(), project.tasks[index], input, {
      updatedAt: new Date(),
    });
    project.tasks[index] = task;
    project.updatedAt = task.updatedAt;
    await this.repository.save(project);
    return task;
  }

  async removeTask(projectId: string, taskId: string): Promise<void> {
    const project = await this.getProject(projectId);
    const index = project.tasks.findIndex((item) => item.id === taskId);
    if (index < 0)
      throw new NotFoundException(
        `Task ${taskId} was not found in project ${projectId}`,
      );
    project.tasks.splice(index, 1);
    project.updatedAt = new Date();
    await this.repository.save(project);
  }
}
