import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

describe('Real OpenAPI compiler plugin', () => {
  it('infers DTO metadata in emitted JavaScript and exposes schema/security', async () => {
    await exec(process.execPath, [
      'node_modules/@nestjs/cli/bin/nest.js',
      'build',
      '--config',
      'nest-cli.swagger.json',
    ]);
    const { stdout } = await exec(process.execPath, [
      'dist-swagger/openapi-lab/main.js',
    ]);
    const document = JSON.parse(stdout);
    const schema = document.components.schemas.CatalogEntryDto;
    expect(schema.properties.title).toMatchObject({
      type: 'string',
      description: 'Public entry title.',
    });
    expect(schema.properties.revision).toMatchObject({
      type: 'number',
      minimum: 1,
    });
    expect(schema.required).toEqual(
      expect.arrayContaining(['title', 'revision']),
    );
    expect(schema.required).not.toContain('summary');
    expect(schema.properties.secret).toBeUndefined();
    expect(document.components.schemas.UpdateCatalogDto.required ?? []).toEqual(
      [],
    );
    expect(document.paths['/catalog'].post.security).toContainEqual({
      apiKey: [],
    });
  }, 30000);
});
