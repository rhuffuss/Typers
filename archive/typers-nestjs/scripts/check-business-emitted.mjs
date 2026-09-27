import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NestFactory } from '@nestjs/core';

const output = resolve(process.argv[2] ?? 'dist');
process.env.NODE_ENV = 'test';
process.env.DEMO_DATABASE = 'memory';
const load = (path) => import(pathToFileURL(resolve(output, path)));
const { quoteUnknown } = await load('business/pricing/index.js');
const { createPlan, planBatches } = await load('business/planning/index.js');
const { AppModule } = await load('app.module.js');
const { configureApp } = await load('platform/configure-app.js');
const checks = [];
const quote = quoteUnknown({
  currency: 'EUR',
  items: [{ sku: 'support-seat', quantity: 3 }],
});
assert.equal(quote.ok, true);
assert.ok(BigInt(quote.value.totals.totalMinor) > 0n);
checks.push('BigInt quote calculation and JSON boundary');
assert.equal(quoteUnknown({ currency: 'FAKE', items: [] }).ok, false);
checks.push('Unknown input rejection');
const input = {
  projectId: 'compiled',
  startDate: '2026-09-15',
  dailyCapacityUnits: 4,
  tasks: [
    { id: 'a', effortUnits: 4 },
    { id: 'b', effortUnits: 8, dependencies: ['a'] },
  ],
};
const plan = createPlan(input);
assert.equal(plan.ok, true);
assert.equal(plan.value.durationDays, 3);
checks.push('Dependency scheduling');
const batches = [];
for await (const batch of planBatches([input], { batchSize: 1 }))
  batches.push(batch);
assert.equal(batches.length, 1);
assert.equal(batches[0].ok, true);
assert.equal(batches[0].value.planned, 1);
checks.push('Async generator execution');

const app = await NestFactory.create(AppModule, {
  logger: false,
  rawBody: true,
});
try {
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const login = async (user) => {
    const role = `${user[0].toUpperCase()}${user.slice(1)}`;
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email:
          process.env[`DEMO_${user.toUpperCase()}_EMAIL`] ??
          `${user}@typers.local`,
        password:
          process.env[`DEMO_${user.toUpperCase()}_PASSWORD`] ??
          `TypersDemo-${role}-2026!`,
      }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).access_token;
  };
  const [member, approver, finance] = await Promise.all(
    ['member', 'approver', 'finance'].map(login),
  );
  checks.push('JWT identities for separate business duties');
  const route = `${base}/api/v1/projects/00000000-0000-4000-8000-000000000010/business`;
  const post = async (path, token, input, status = 200) => {
    const response = await fetch(`${route}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  };
  let expense = await post(
    '/expenses',
    member,
    { title: 'Emitted code review', amountMinor: 12000, currency: 'EUR' },
    201,
  );
  assert.equal(expense.state, 'draft');
  checks.push('Nest DI metadata and DTO validation');
  expense = await post(`/expenses/${expense.id}/submit`, member, {
    expectedVersion: expense.version,
  });
  assert.equal(expense.state, 'submitted');
  checks.push('OOP aggregate submission');
  expense = await post(`/expenses/${expense.id}/approve`, approver, {
    expectedVersion: expense.version,
  });
  assert.equal(expense.state, 'approved');
  checks.push('Role policy and state transition');
  const payment = {
    expectedVersion: expense.version,
    idempotencyKey: 'emitted-payment-001',
  };
  expense = await post(`/expenses/${expense.id}/pay`, finance, payment);
  assert.equal(expense.state, 'paid');
  checks.push('Simulated payment and audit event');
  assert.deepEqual(
    await post(`/expenses/${expense.id}/pay`, finance, payment),
    expense,
  );
  checks.push('Idempotent payment replay');
  console.log(
    JSON.stringify(
      {
        output,
        node: process.version,
        status: 'passed',
        checks: checks.length,
        scenarios: checks,
        execution:
          'Native Node.js importing emitted ESM; no TypeScript transformer',
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
}
