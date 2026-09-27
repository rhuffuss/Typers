import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/platform/configure-app.js';
import type { ExpenseSnapshot } from '../src/business/approvals/index.js';

const seedProject = '00000000-0000-4000-8000-000000000010';
const base = `/api/v1/projects/${seedProject}/business`;
const users = ['admin', 'reader', 'member', 'approver', 'finance'] as const;
type DemoUser = (typeof users)[number];

describe('Project business workflows over HTTP', () => {
  let app: NestExpressApplication;
  let server: App;
  const tokens = {} as Record<DemoUser, string>;
  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
      rawBody: true,
    });
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as App;
    await Promise.all(
      users.map(async (user) => {
        const title = `${user[0].toUpperCase()}${user.slice(1)}`;
        const response = await request(server)
          .post('/api/v1/auth/login')
          .send({
            email: `${user}@typers.local`,
            password: `TypersDemo-${title}-2026!`,
          })
          .expect(200);
        tokens[user] = response.body.access_token as string;
      }),
    );
  });
  afterAll(async () => {
    await app?.close();
  });

  const post = (url: string, user: DemoUser, body: object) =>
    request(server).post(url).auth(tokens[user], { type: 'bearer' }).send(body);
  const createExpense = async (
    amountMinor = 12000,
  ): Promise<ExpenseSnapshot> => {
    const response = await post(`${base}/expenses`, 'member', {
      title: 'Security review for project',
      amountMinor,
      currency: 'EUR',
    }).expect(201);
    return response.body as ExpenseSnapshot;
  };

  it('calculates a quote with exact JSON money and rejects malformed or over-budget inputs', async () => {
    const quote = {
      currency: 'EUR',
      items: [{ sku: 'support-seat', quantity: 3 }],
    };
    const response = await post(`${base}/quotes`, 'reader', quote).expect(200);
    expect(response.body.projectId).toBe(seedProject);
    expect(response.body.quote.totals.totalMinor).toMatch(/^\d+$/);
    expect(BigInt(response.body.quote.totals.totalMinor)).toBeGreaterThan(0n);
    const overBudget = await post(`${base}/quotes`, 'reader', {
      ...quote,
      budgetMinor: '1',
    }).expect(422);
    expect(overBudget.body).toMatchObject({
      code: 'BUDGET_EXCEEDED',
      path: 'budgetMinor',
      details: {
        excessMinor: (
          BigInt(response.body.quote.totals.totalMinor) - 1n
        ).toString(),
      },
    });
    await post(`${base}/quotes`, 'reader', {
      ...quote,
      items: [{ sku: 'support-seat', quantity: 1.5 }],
    }).expect(400);
    await post(`${base}/quotes`, 'reader', {
      ...quote,
      currency: 'FAKE',
    }).expect(400);
    await request(server).post(`${base}/quotes`).send(quote).expect(401);
  });

  it('schedules dependencies, exposes deadline/budget warnings and rejects a cyclic plan', async () => {
    const input = {
      startDate: '2026-09-15',
      dailyCapacityUnits: 4,
      costPerUnitCents: 100,
      budgetCents: 100,
      tasks: [
        { id: 'design', effortUnits: 4 },
        {
          id: 'build',
          effortUnits: 8,
          dependencies: ['design'],
          deadlineDay: 1,
        },
      ],
    };
    const response = await post(`${base}/plans`, 'member', input).expect(200);
    expect(response.body).toMatchObject({
      projectId: seedProject,
      durationDays: 3,
      totalEffortUnits: 12,
      totalCostCents: 1200,
      withinBudget: false,
    });
    expect(
      response.body.tasks.find((task: { id: string }) => task.id === 'build'),
    ).toMatchObject({ startDay: 1, endDay: 2, latenessDays: 1 });
    expect(
      response.body.warnings.map((warning: { code: string }) => warning.code),
    ).toEqual(expect.arrayContaining(['deadline-missed', 'budget-exceeded']));
    const cyclic = await post(`${base}/plans`, 'member', {
      ...input,
      tasks: [
        { id: 'a', effortUnits: 1, dependencies: ['b'] },
        { id: 'b', effortUnits: 1, dependencies: ['a'] },
      ],
    }).expect(422);
    expect(cyclic.body.code).toBe('cyclic-dependency');
    expect(cyclic.body.cycle).toEqual(expect.arrayContaining(['a', 'b']));
    await post(`${base}/plans`, 'member', {
      ...input,
      projectId: 'another-project',
    }).expect(400);
  });

  it('separates requester, reviewer and payer and replays a payment without a second audit event', async () => {
    let expense = await createExpense();
    expect(expense).toMatchObject({
      state: 'draft',
      version: 1,
      requesterId: '00000000-0000-4000-8000-000000000003',
    });
    expense = (
      await post(`${base}/expenses/${expense.id}/submit`, 'member', {
        expectedVersion: expense.version,
      }).expect(200)
    ).body as ExpenseSnapshot;
    await post(`${base}/expenses/${expense.id}/approve`, 'member', {
      expectedVersion: expense.version,
    }).expect(403);
    expense = (
      await post(`${base}/expenses/${expense.id}/approve`, 'approver', {
        expectedVersion: expense.version,
      }).expect(200)
    ).body as ExpenseSnapshot;
    expect(expense.state).toBe('approved');
    const payment = {
      expectedVersion: expense.version,
      idempotencyKey: `payment-${randomUUID()}`,
    };
    await post(
      `${base}/expenses/${expense.id}/pay`,
      'approver',
      payment,
    ).expect(403);
    const paid = await post(
      `${base}/expenses/${expense.id}/pay`,
      'finance',
      payment,
    ).expect(200);
    const replay = await post(
      `${base}/expenses/${expense.id}/pay`,
      'finance',
      payment,
    ).expect(200);
    expect(replay.body).toEqual(paid.body);
    expect(paid.body.state).toBe('paid');
    expect(
      paid.body.audit.filter(
        (event: { type: string }) => event.type === 'expense.paid',
      ),
    ).toHaveLength(1);
    const altered = await post(
      `${base}/expenses/${expense.id}/pay`,
      'finance',
      { ...payment, expectedVersion: paid.body.version },
    ).expect(409);
    expect(altered.body.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('requires three distinct reviewers including finance and admin above the highest threshold', async () => {
    let expense = await createExpense(600000);
    expense = (
      await post(`${base}/expenses/${expense.id}/submit`, 'member', {
        expectedVersion: expense.version,
      }).expect(200)
    ).body as ExpenseSnapshot;
    expect(expense.requirements).toMatchObject({
      quorum: 3,
      requiresFinance: true,
      requiresAdmin: true,
    });
    for (const reviewer of ['approver', 'finance', 'admin'] as const) {
      expense = (
        await post(`${base}/expenses/${expense.id}/approve`, reviewer, {
          expectedVersion: expense.version,
        }).expect(200)
      ).body as ExpenseSnapshot;
      expect(expense.state).toBe(
        reviewer === 'admin' ? 'approved' : 'submitted',
      );
    }
    expect(expense.approvals).toHaveLength(3);
  });

  it('detects stale writes and enforces project binding and expense visibility', async () => {
    const expense = await createExpense();
    await post(`${base}/expenses/${expense.id}/submit`, 'member', {
      expectedVersion: expense.version,
    }).expect(200);
    const stale = await post(
      `${base}/expenses/${expense.id}/approve`,
      'admin',
      { expectedVersion: expense.version },
    ).expect(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
    await request(server)
      .get(`${base}/expenses/${expense.id}`)
      .auth(tokens.reader, { type: 'bearer' })
      .expect(403);
    const other = await post('/api/v1/projects', 'admin', {
      name: 'Other project',
      slug: `other-${randomUUID()}`,
    }).expect(201);
    await request(server)
      .get(`/api/v1/projects/${other.body.id}/business/expenses/${expense.id}`)
      .auth(tokens.admin, { type: 'bearer' })
      .expect(404);
    await post(`${base}/expenses`, 'member', {
      title: 'Invalid cents',
      amountMinor: 1.2,
      currency: 'EUR',
      requesterId: 'forged',
    }).expect(400);
  });

  it('keeps rejection terminal and blocks new workflows after a project is archived', async () => {
    let expense = await createExpense();
    expense = (
      await post(`${base}/expenses/${expense.id}/submit`, 'member', {
        expectedVersion: expense.version,
      }).expect(200)
    ).body as ExpenseSnapshot;
    expense = (
      await post(`${base}/expenses/${expense.id}/reject`, 'admin', {
        expectedVersion: expense.version,
        reason: 'Supplier exceeds budget',
      }).expect(200)
    ).body as ExpenseSnapshot;
    expect(expense.state).toBe('rejected');
    await post(`${base}/expenses/${expense.id}/approve`, 'admin', {
      expectedVersion: expense.version,
    }).expect(409);
    const project = await post('/api/v1/projects', 'admin', {
      name: 'Archived project',
      slug: `archive-${randomUUID()}`,
    }).expect(201);
    await request(server)
      .patch(`/api/v1/projects/${project.body.id}`)
      .auth(tokens.admin, { type: 'bearer' })
      .send({ status: 'archived' })
      .expect(200);
    const response = await post(
      `/api/v1/projects/${project.body.id}/business/expenses`,
      'member',
      { title: 'No new spending', amountMinor: 100, currency: 'EUR' },
    ).expect(409);
    expect(response.body.code).toBe('PROJECT_ARCHIVED');
  });

  it('publishes the business inputs and additional financial roles in OpenAPI', async () => {
    const { body } = await request(server).get('/openapi.json').expect(200);
    expect(
      body.paths['/api/v1/projects/{projectId}/business/quotes'].post
        .requestBody.content['application/json'].schema,
    ).toMatchObject({ required: ['currency', 'items'] });
    const quoteOutput =
      body.paths['/api/v1/projects/{projectId}/business/quotes'].post.responses[
        '200'
      ].content['application/json'].schema;
    expect(
      quoteOutput.properties.quote.properties.totals.properties.totalMinor.type,
    ).toBe('string');
    const expenseOutput =
      body.paths['/api/v1/projects/{projectId}/business/expenses'].post
        .responses['201'].content['application/json'].schema;
    expect(expenseOutput.properties.version.type).toBe('integer');
    expect(expenseOutput.properties.state.enum).toContain('paid');
    expect(expenseOutput.properties.audit.items.oneOf).toHaveLength(5);
    expect(
      body.paths['/api/v1/projects/{projectId}/business/plans'].post.responses[
        '200'
      ].content['application/json'].schema.properties.criticalPath,
    ).toBeDefined();
    expect(body.components.schemas.Role.enum).toEqual(
      expect.arrayContaining(['member', 'approver', 'finance']),
    );
  });
});
