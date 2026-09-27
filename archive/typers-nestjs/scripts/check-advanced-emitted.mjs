import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';

const output = resolve(process.argv[2] ?? 'dist');
const load = (path) => import(pathToFileURL(resolve(output, path)));
process.env.NODE_ENV = 'test';
process.env.LAB_OPERATIONS_CAPACITY = '100';
process.env.LAB_OPERATIONS_HOLD_MS = '60000';
const checks = [];
const { OperationsLabModule } = await load(
  'operations-lab/operations-lab.module.js',
);
const { ReservationEngine } = await load(
  'operations-lab/reservation-engine.js',
);
const app = await NestFactory.create(OperationsLabModule, {
  logger: false,
  abortOnError: false,
});
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '2' });
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
try {
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const policy = await fetch(`${base}/v2/operations/policy`);
  assert.deepEqual(await policy.json(), { capacity: 100, holdMs: 60000 });
  checks.push('Namespaced configuration and asynchronous module injection');
  const neutral = await fetch(`${base}/operations/status`);
  assert.equal(neutral.status, 200);
  assert.deepEqual(await neutral.json(), { status: 'ready' });
  const v2 = await fetch(`${base}/v2/operations/summary`);
  assert.equal(v2.headers.get('x-inventory-contract'), '2');
  assert.deepEqual(await v2.json(), { inventory: { used: 0, capacity: 100 } });
  checks.push('Neutral/multiple versions and versioned middleware');
  const held = await fetch(`${base}/v2/operations/holds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'emitted', units: 3 }),
  });
  assert.equal(held.status, 201);
  assert.equal((await held.json()).status, 'held');
  const confirmed = await fetch(`${base}/v1/operations/holds/emitted/confirm`, {
    method: 'POST',
  });
  assert.equal(confirmed.status, 201);
  assert.equal((await confirmed.json()).status, 'confirmed');
  const forged = await fetch(`${base}/v2/operations/holds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'forged', units: 1, status: 'confirmed' }),
  });
  assert.equal(forged.status, 400);
  await forged.body?.cancel();
  checks.push('Emitted DTO metadata and inventory transitions');
  const engine = app.get(ReservationEngine);
  const registry = app.get(SchedulerRegistry);
  engine.reserve('expires', 4, 10);
  engine.startSampling(10);
  engine.startSweep();
  const deadline = Date.now() + 5000;
  while (
    engine.metrics().sweepRuns === 0 ||
    engine.metrics().samples.length === 0 ||
    engine.used !== 3
  ) {
    assert.ok(Date.now() < deadline, 'Dynamic jobs did not execute');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  checks.push('Real dynamic timeout, interval and cron');
  await app.close();
  assert.equal(registry.getCronJobs().size, 0);
  assert.deepEqual(registry.getIntervals(), []);
  assert.deepEqual(registry.getTimeouts(), []);
  checks.push('Scheduler shutdown removes all dynamic jobs');
} finally {
  await app.close();
}

const { createAdvancedDiLab } = await load('fundamentals-advanced/harness.js');
const lab = await createAdvancedDiLab();
try {
  await lab.app.listen(0, '127.0.0.1');
  const base = await lab.app.getUrl();
  const quote = async (tenant, tag) => {
    const response = await fetch(`${base}/api/tenant-quotes?units=2`, {
      headers: { 'x-tenant-id': tenant, 'x-demo-request-tag': tag },
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const [acme, globex, repeated] = await Promise.all([
    quote('acme', 'first'),
    quote('globex', 'other'),
    quote('acme', 'second'),
  ]);
  assert.equal(acme.totalMinor, 2500);
  assert.equal(globex.totalMinor, 4000);
  assert.equal(acme.rateBookId, repeated.rateBookId);
  assert.notEqual(acme.rateBookId, globex.rateBookId);
  assert.notEqual(acme.requestId, repeated.requestId);
  assert.equal(repeated.requestTag, 'second');
  checks.push(
    'Durable provider identity and concurrent tenant/request isolation',
  );
  const audit = await fetch(`${base}/api/di/audit`);
  assert.equal(audit.status, 200);
  const auditBody = await audit.json();
  assert.equal(auditBody.purchase.consumer, 'PurchaseReviewService');
  assert.equal(auditBody.credit.consumer, 'CreditReviewService');
  checks.push('INQUIRER identifies the consuming service');
  const receipt = await fetch(`${base}/api/di/receipt`);
  assert.equal(receipt.status, 200);
  const body = await receipt.json();
  assert.deepEqual(body, {
    reference: 'receipt-demo',
    amountMinor: 1500,
    currencySymbol: '€',
    footer: 'Local expense copy',
    followUpDays: 7,
  });
  checks.push('Optional constructor/property/factory injection and defaults');
} finally {
  await lab.close();
  assert.deepEqual(lab.strategy.cachedTenants, []);
}
console.log(
  JSON.stringify(
    { status: 'passed', output, checks, count: checks.length },
    null,
    2,
  ),
);
