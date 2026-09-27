import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../security/role.enum.js';
import { Auth, CurrentUser } from '../security/security.decorators.js';
import {
  CreateProjectDto,
  CreateTaskDto,
  ProjectDto,
  ProjectPageDto,
  ProjectQueryDto,
  TaskDto,
  UpdateProjectDto,
  UpdateTaskDto,
} from './workspaces.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@ApiTags('Projects and tasks')
@ApiBadRequestResponse({ description: 'Invalid DTO, query, or UUID parameter' })
@ApiNotFoundResponse({ description: 'Project or task does not exist' })
@Controller('projects')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  @ApiOperation({ summary: 'List public projects with pagination and filters' })
  @ApiOkResponse({ type: ProjectPageDto })
  list(@Query() query: ProjectQueryDto): Promise<ProjectPageDto> {
    return this.workspaces.listProjects(query);
  }

  @Get(':projectId')
  @ApiOkResponse({ type: ProjectDto })
  get(@Param('projectId', ParseUUIDPipe) id: string): Promise<ProjectDto> {
    return this.workspaces.getProject(id);
  }

  @Post()
  @Auth(Role.Admin, Role.Member)
  @ApiCreatedResponse({ type: ProjectDto })
  @ApiConflictResponse({ description: 'Slug already exists' })
  create(
    @Body() input: CreateProjectDto,
    @CurrentUser('id') userId: string,
  ): Promise<ProjectDto> {
    return this.workspaces.createProject(input, userId);
  }

  @Patch(':projectId')
  @Auth(Role.Admin, Role.Member)
  @ApiOkResponse({ type: ProjectDto })
  @ApiConflictResponse({ description: 'Slug already exists' })
  update(
    @Param('projectId', ParseUUIDPipe) id: string,
    @Body() input: UpdateProjectDto,
  ): Promise<ProjectDto> {
    return this.workspaces.updateProject(id, input);
  }

  @Delete(':projectId')
  @Auth(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('projectId', ParseUUIDPipe) id: string): Promise<void> {
    return this.workspaces.removeProject(id);
  }

  @Get(':projectId/tasks')
  @ApiOkResponse({ type: TaskDto, isArray: true })
  tasks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<TaskDto[]> {
    return this.workspaces.listTasks(projectId);
  }

  @Get(':projectId/tasks/:taskId')
  @ApiOkResponse({ type: TaskDto })
  task(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<TaskDto> {
    return this.workspaces.getTask(projectId, taskId);
  }

  @Post(':projectId/tasks')
  @Auth(Role.Admin, Role.Member)
  @ApiCreatedResponse({ type: TaskDto })
  createTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() input: CreateTaskDto,
  ): Promise<TaskDto> {
    return this.workspaces.createTask(projectId, input);
  }

  @Patch(':projectId/tasks/:taskId')
  @Auth(Role.Admin, Role.Member)
  @ApiOkResponse({ type: TaskDto })
  updateTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() input: UpdateTaskDto,
  ): Promise<TaskDto> {
    return this.workspaces.updateTask(projectId, taskId, input);
  }

  @Delete(':projectId/tasks/:taskId')
  @Auth(Role.Admin, Role.Member)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeTask(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<void> {
    return this.workspaces.removeTask(projectId, taskId);
  }
}
