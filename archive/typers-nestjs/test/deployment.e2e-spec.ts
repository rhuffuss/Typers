import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { Agent as HttpAgent, get as httpGet } from 'node:http';
import { Agent as HttpsAgent, get as httpsGet } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLambdaHandler } from '../src/deployment-lab/lambda.js';
import { createMultipleServers } from '../src/deployment-lab/multiple-servers.js';

const execFileAsync = promisify(execFile);

function gatewayEvent(
  path: string,
  method = 'GET',
  body?: string,
  isBase64Encoded = false,
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: { host: 'localhost', 'content-type': 'application/json' },
    requestContext: {
      accountId: 'local-account',
      apiId: 'local-api',
      domainName: 'localhost',
      domainPrefix: 'local',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'Vitest',
      },
      requestId: randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: '15/Sep/2026:00:00:00 +0000',
      timeEpoch: Date.now(),
    },
    body,
    isBase64Encoded,
  };
}

function lambdaContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'typers-local-lambda',
    functionVersion: '$LATEST',
    invokedFunctionArn:
      'arn:aws:lambda:local:000000000000:function:typers-local-lambda',
    memoryLimitInMB: '128',
    awsRequestId: randomUUID(),
    logGroupName: 'local-test',
    logStreamName: 'local-test',
    getRemainingTimeInMillis: () => 30000,
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  };
}

function resultBody(
  result: APIGatewayProxyStructuredResultV2,
): Record<string, unknown> {
  const body = result.isBase64Encoded
    ? Buffer.from(result.body ?? '', 'base64').toString('utf8')
    : (result.body ?? '');
  return JSON.parse(body) as Record<string, unknown>;
}

function readJson(
  url: string,
  agent: HttpAgent | HttpsAgent,
): Promise<{
  status: number | undefined;
  body: Record<string, unknown>;
  reusedSocket: boolean;
}> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https:') ? httpsGet : httpGet;
    const req = get(url, { agent, servername: 'localhost' }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
              string,
              unknown
            >,
            reusedSocket: req.reusedSocket,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () =>
      req.destroy(new Error('Local HTTP request timed out')),
    );
  });
}

describe('Serverless API Gateway event adapter', () => {
  const lambda = createLambdaHandler();
  const invoke = async (event: APIGatewayProxyEventV2) => {
    const context = lambdaContext();
    const response = await lambda.handler(event, context, () => undefined);
    if (!response)
      throw new Error('Expected a promise response from serverless-express');
    expect(context.callbackWaitsForEmptyEventLoop).toBe(false);
    return response;
  };

  afterAll(async () => {
    await lambda.close();
  });

  it('shares a single Nest initialization across cold invocations and reuses it when warm', async () => {
    const responses = await Promise.all([
      invoke(gatewayEvent('/deployment/status')),
      invoke(gatewayEvent('/deployment/status')),
    ]);
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 200,
    ]);
    const bodies = responses.map(resultBody);
    expect(bodies[0].instanceId).toEqual(bodies[1].instanceId);
    expect(new Set(bodies.map((body) => body.invocation))).toEqual(
      new Set([1, 2]),
    );
    const warm = resultBody(await invoke(gatewayEvent('/deployment/status')));
    expect(warm).toMatchObject({
      instanceId: bodies[0].instanceId,
      invocation: 3,
    });
  });

  it('decodes an API Gateway base64 body and applies Nest validation and routing', async () => {
    const body = Buffer.from(
      JSON.stringify({ message: 'Hello Lambda adapter' }),
    ).toString('base64');
    const response = await invoke(
      gatewayEvent('/deployment/echo', 'POST', body, true),
    );
    expect(response.statusCode).toBe(201);
    expect(resultBody(response)).toEqual({ message: 'Hello Lambda adapter' });
    const invalid = await invoke(
      gatewayEvent(
        '/deployment/echo',
        'POST',
        JSON.stringify({ message: '', injected: true }),
      ),
    );
    expect(invalid.statusCode).toBe(400);
    expect((await invoke(gatewayEvent('/deployment/missing'))).statusCode).toBe(
      404,
    );
  });

  it('explicitly closes a cached application and permits a fresh local bootstrap', async () => {
    const first = resultBody(await invoke(gatewayEvent('/deployment/status')));
    await lambda.close();
    const second = resultBody(await invoke(gatewayEvent('/deployment/status')));
    expect(second.instanceId).not.toBe(first.instanceId);
    expect(second.invocation).toBe(1);
  });
});

describe('Shared HTTP/HTTPS listener and keep-alive', () => {
  let directory: string;
  let servers: Awaited<ReturnType<typeof createMultipleServers>>;
  let httpAgent: HttpAgent;
  let httpsAgent: HttpsAgent;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'typers-local-tls-'));
    await Promise.all([
      execFileAsync(
        'openssl',
        [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          'ca.key',
          '-out',
          'ca.crt',
          '-days',
          '1',
          '-subj',
          '/CN=Typers Temporary Test CA',
        ],
        { cwd: directory, timeout: 10000 },
      ),
      execFileAsync(
        'openssl',
        [
          'req',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          'server.key',
          '-out',
          'server.csr',
          '-subj',
          '/CN=localhost',
        ],
        { cwd: directory, timeout: 10000 },
      ),
    ]);
    await writeFile(
      join(directory, 'server.ext'),
      [
        'basicConstraints=CA:FALSE',
        'keyUsage=digitalSignature,keyEncipherment',
        'extendedKeyUsage=serverAuth',
        'subjectAltName=DNS:localhost,IP:127.0.0.1',
      ].join('\n'),
      { mode: 0o600 },
    );
    await execFileAsync(
      'openssl',
      [
        'x509',
        '-req',
        '-in',
        'server.csr',
        '-CA',
        'ca.crt',
        '-CAkey',
        'ca.key',
        '-CAcreateserial',
        '-out',
        'server.crt',
        '-days',
        '1',
        '-extfile',
        'server.ext',
      ],
      { cwd: directory, timeout: 10000 },
    );
    const [key, cert, ca] = await Promise.all(
      ['server.key', 'server.crt', 'ca.crt'].map((name) =>
        readFile(join(directory, name)),
      ),
    );
    servers = await createMultipleServers({
      key,
      cert,
      keepAliveTimeout: 5000,
    });
    httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 1 });
    httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 1, ca });
  }, 30000);

  afterAll(async () => {
    httpAgent?.destroy();
    httpsAgent?.destroy();
    try {
      await servers?.close();
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });

  it('serves the same Nest application through HTTP and trusted localhost TLS', async () => {
    const plain = await readJson(
      `${servers.httpUrl}/deployment/status`,
      httpAgent,
    );
    const secure = await readJson(
      `${servers.httpsUrl}/deployment/status`,
      httpsAgent,
    );
    expect(plain.status).toBe(200);
    expect(secure.status).toBe(200);
    expect(secure.body.instanceId).toBe(plain.body.instanceId);
    expect(secure.body.invocation).toBe(Number(plain.body.invocation) + 1);
    expect(servers.httpServer.keepAliveTimeout).toBe(5000);
    expect(servers.httpsServer.keepAliveTimeout).toBe(5000);
    expect(servers.httpsServer.headersTimeout).toBe(6000);
  });

  it('reuses actual TCP sockets with keep-alive agents on both protocols', async () => {
    for (const [url, agent, encrypted] of [
      [servers.httpUrl, httpAgent, false],
      [servers.httpsUrl, httpsAgent, true],
    ] as const) {
      const first = await readJson(`${url}/deployment/connection`, agent);
      const second = await readJson(`${url}/deployment/connection`, agent);
      expect(second.reusedSocket).toBe(true);
      expect(second.body.remotePort).toBe(first.body.remotePort);
      expect(second.body.encrypted).toBe(encrypted);
    }
  });

  it('rejects the temporary certificate without the explicitly trusted test CA', async () => {
    const untrustedAgent = new HttpsAgent();
    try {
      await expect(
        readJson(`${servers.httpsUrl}/deployment/status`, untrustedAgent),
      ).rejects.toMatchObject({
        code: expect.stringMatching(/CERT|UNABLE_TO_VERIFY/),
      });
    } finally {
      untrustedAgent.destroy();
    }
  });
});
