import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';

const output = resolve(process.argv[2] ?? 'dist');
// This reference smoke test is independent of the developer's database profile.
process.env.DEMO_DATABASE = 'memory';
process.env.NODE_ENV = 'test';
const { AppModule } = await import(
  pathToFileURL(resolve(output, 'app.module.js'))
);
const { configureApp } = await import(
  pathToFileURL(resolve(output, 'platform/configure-app.js'))
);
const app = await NestFactory.create(AppModule, {
  logger: false,
  rawBody: true,
});
try {
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const health = await fetch(`${base}/api/v1/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  assert.equal((await fetch(`${base}/static/demo.txt`)).status, 200);
  assert.match(
    await (await fetch(`${base}/api/v1/techniques/view`)).text(),
    /MVC renderizado/,
  );
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.DEMO_ADMIN_EMAIL ?? 'admin@typers.local',
      password: process.env.DEMO_ADMIN_PASSWORD ?? 'TypersDemo-Admin-2026!',
    }),
  });
  assert.equal(login.status, 200);
  const { access_token: token } = await login.json();
  assert.equal(typeof token, 'string');
  assert.equal(
    (
      await fetch(`${base}/api/v1/auth/me`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
    200,
  );
  const invalid = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(invalid.status, 400);
  const document = await (await fetch(`${base}/openapi.json`)).json();
  assert.ok(document.paths['/api/v1/auth/login']);
  const graphql = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: '{ __typename }' }),
  });
  assert.deepEqual(await graphql.json(), { data: { __typename: 'Query' } });
  console.log(
    JSON.stringify(
      {
        output,
        node: process.version,
        checks: 8,
        status: 'passed',
        execution:
          'Native Node.js importing emitted ESM; no TypeScript test transformer',
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
