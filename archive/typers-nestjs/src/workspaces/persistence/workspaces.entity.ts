import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { ProjectStatus, TaskStatus } from '../workspaces.dto.js';

@Entity('projects')
@Index('UQ_projects_slug', ['slug'], { unique: true })
export class ProjectRecordEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    enumName: 'project_status',
    default: ProjectStatus.Active,
  })
  status: ProjectStatus;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  labels: string[];

  @Column({ type: 'uuid' })
  ownerId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => TaskRecordEntity, (task) => task.project)
  tasks: Relation<TaskRecordEntity[]>;
}

@Entity('tasks')
@Index('IDX_tasks_project_id', ['projectId'])
export class TaskRecordEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  projectId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    enumName: 'task_status',
    default: TaskStatus.Todo,
  })
  status: TaskStatus;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz' })
  updatedAt: Date;

  // Relation<T> avoids eager decorator metadata references in native ESM.
  @ManyToOne(() => ProjectRecordEntity, (project) => project.tasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'projectId',
    foreignKeyConstraintName: 'FK_tasks_project',
  })
  project: Relation<ProjectRecordEntity>;
}
