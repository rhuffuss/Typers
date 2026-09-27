import {
  type MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateWorkspaces1789488000000 implements MigrationInterface {
  name = 'CreateWorkspaces1789488000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = this.schema(queryRunner);
    await queryRunner.createTable(
      new Table({
        name: 'projects',
        schema,
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'slug', type: 'varchar', length: '80' },
          { name: 'description', type: 'text', default: "''" },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'archived'],
            enumName: 'project_status',
            default: "'active'",
          },
          { name: 'labels', type: 'jsonb', default: "'[]'::jsonb" },
          { name: 'ownerId', type: 'uuid' },
          { name: 'createdAt', type: 'timestamptz' },
          { name: 'updatedAt', type: 'timestamptz' },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_projects_slug',
            columnNames: ['slug'],
            isUnique: true,
          }),
        ],
      }),
    );
    await queryRunner.createTable(
      new Table({
        name: 'tasks',
        schema,
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'projectId', type: 'uuid' },
          { name: 'title', type: 'varchar', length: '200' },
          {
            name: 'status',
            type: 'enum',
            enum: ['todo', 'in_progress', 'done'],
            enumName: 'task_status',
            default: "'todo'",
          },
          { name: 'createdAt', type: 'timestamptz' },
          { name: 'updatedAt', type: 'timestamptz' },
        ],
        indices: [
          new TableIndex({
            name: 'IDX_tasks_project_id',
            columnNames: ['projectId'],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: 'FK_tasks_project',
            columnNames: ['projectId'],
            referencedTableName: 'projects',
            referencedSchema: schema,
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema = this.schema(queryRunner);
    await queryRunner.dropTable(`${schema}.tasks`);
    await queryRunner.dropTable(`${schema}.projects`);
    // PostgreSQL enum types outlive tables unless explicitly removed.
    await queryRunner.query(`DROP TYPE IF EXISTS "${schema}"."task_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "${schema}"."project_status"`);
  }

  private schema(queryRunner: QueryRunner): string {
    const options = queryRunner.connection.options;
    const schema =
      'schema' in options && typeof options.schema === 'string'
        ? options.schema
        : 'public';
    if (!/^[a-z_][a-z0-9_]*$/.test(schema))
      throw new Error('Invalid PostgreSQL schema identifier');
    return schema;
  }
}
