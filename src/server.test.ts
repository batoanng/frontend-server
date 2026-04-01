import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import type { Request as ExpressRequest } from 'express';
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, describe, expect, test } from 'vitest';

import { buildServer } from '@/server';
import type { BuildServerParams } from '@/types';

const runningServers: HttpServer[] = [];
const tempDirectories: string[] = [];

const closeServer = (server: HttpServer) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error != null) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const resolveServer = async (server: HttpServer) => {
  runningServers.push(server);

  if (!server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.once('listening', () => {
        server.off('error', reject);
        resolve();
      });
    });
  }

  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('Expected a TCP server address.');
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
};

const createClientBuildPath = () => {
  const buildPath = mkdtempSync(join(tmpdir(), 'frontend-server-'));
  tempDirectories.push(buildPath);

  writeFileSync(
    join(buildPath, 'index.html'),
    '<html><head></head><body><script src="/app.js"></script></body></html>'
  );
  writeFileSync(join(buildPath, 'app.js'), 'console.log("frontend-server");');
  writeFileSync(join(buildPath, 'client.env.development'), 'VITE_RUNTIME_FLAG="enabled"\n');

  return buildPath;
};

const startTargetServer = async () => {
  let requestCount = 0;

  const server = createHttpServer((req, res) => {
    requestCount += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        path: req.url,
        method: req.method,
      })
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const runningServer = await resolveServer(server);

  return {
    ...runningServer,
    getRequestCount: () => requestCount,
  };
};

const startFrontendServer = async (overrides: Partial<BuildServerParams> = {}) => {
  const targetServer = await startTargetServer();
  const clientBuildPath = createClientBuildPath();

  const { server } = buildServer({
    targetServerUrl: targetServer.baseUrl,
    clientBuildPath,
    corsOptions: {
      allowedOrigins: ['*'],
    },
    ...overrides,
  });

  const httpServer = server.listen(0, '127.0.0.1');
  const frontendServer = await resolveServer(httpServer);

  return {
    ...frontendServer,
    targetServer,
  };
};

const requestAsClient = (baseUrl: string, path: string, clientKey = 'client-a', init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('x-test-client', clientKey);

  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
};

const testKeyGenerator = (req: ExpressRequest) => req.header('x-test-client') ?? req.ip ?? 'unknown';

afterEach(async () => {
  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server != null && server.listening) {
      await closeServer(server);
    }
  }

  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory != null) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe('buildServer', () => {
  test('returns default limiter diagnostics from /details', async () => {
    const { baseUrl } = await startFrontendServer();

    const response = await fetch(`${baseUrl}/details`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.nodeEnv).toBe('development');
    expect(body.appPrefix).toBe('');
    expect(body.allowedMethods).toEqual(['GET', 'PUT', 'PATCH', 'POST', 'DELETE']);
    expect(body.rateLimit.enabled).toBe(true);
    expect(body.rateLimit.algorithm).toBe('leaky-bucket');
    expect(body.rateLimit.requestsPerSecond).toBe(100);
    expect(body.rateLimit.bucketCapacity).toBe(100);
    expect(body.rateLimit.bypass).toEqual({
      methods: ['OPTIONS'],
      paths: ['/health'],
    });
    expect(body.rateLimit.trackedClientCount).toBe(1);
    expect(body.rateLimit.currentClient.key).toEqual(expect.any(String));
    expect(body.rateLimit.currentClient.accepted).toBe(1);
    expect(body.rateLimit.currentClient.rejected).toBe(0);
    expect(body.rateLimit.currentClient.bucketLevel).toBeGreaterThan(0);
    expect(body.rateLimit.currentClient.remainingApprox).toBeLessThan(100);
    expect(Date.parse(body.rateLimit.currentClient.lastUpdatedAt)).not.toBeNaN();
  });

  test('bypasses the limiter for /health', async () => {
    const { baseUrl } = await startFrontendServer({
      rateLimitOptions: {
        requestsPerSecond: 1,
        bucketCapacity: 1,
        keyGenerator: testKeyGenerator,
      },
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await requestAsClient(baseUrl, '/health');
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Healthy');
    }

    const detailsResponse = await requestAsClient(baseUrl, '/details');
    const body = await detailsResponse.json();

    expect(detailsResponse.status).toBe(200);
    expect(body.rateLimit.currentClient.accepted).toBe(1);
    expect(body.rateLimit.currentClient.rejected).toBe(0);
  });

  test('bypasses the limiter for OPTIONS requests', async () => {
    const { baseUrl } = await startFrontendServer({
      rateLimitOptions: {
        requestsPerSecond: 1,
        bucketCapacity: 1,
        keyGenerator: testKeyGenerator,
      },
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await requestAsClient(baseUrl, '/api/test', 'client-a', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.status).toBe(204);
    }

    const detailsResponse = await requestAsClient(baseUrl, '/details');
    const body = await detailsResponse.json();

    expect(detailsResponse.status).toBe(200);
    expect(body.rateLimit.currentClient.accepted).toBe(1);
    expect(body.rateLimit.currentClient.rejected).toBe(0);
  });

  test('limits index and static asset requests', async () => {
    const { baseUrl } = await startFrontendServer({
      rateLimitOptions: {
        requestsPerSecond: 2,
        bucketCapacity: 2,
        keyGenerator: testKeyGenerator,
      },
    });

    expect((await requestAsClient(baseUrl, '/')).status).toBe(200);
    expect((await requestAsClient(baseUrl, '/app.js')).status).toBe(200);

    const rejectedResponse = await requestAsClient(baseUrl, '/anything');
    const body = await rejectedResponse.json();

    expect(rejectedResponse.status).toBe(429);
    expect(rejectedResponse.headers.get('retry-after')).toBe('1');
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.requestsPerSecond).toBe(2);
    expect(body.bucketCapacity).toBe(2);
    expect(body.retryAfterMs).toBeGreaterThan(0);
    expect(body.retryAfterMs).toBeLessThanOrEqual(500);
    expect(body.remainingApprox).toBeGreaterThanOrEqual(0);
    expect(body.remainingApprox).toBeLessThan(1);
  });

  test('limits proxied api requests', async () => {
    const { baseUrl, targetServer } = await startFrontendServer({
      rateLimitOptions: {
        requestsPerSecond: 1,
        bucketCapacity: 1,
        keyGenerator: testKeyGenerator,
      },
    });

    const firstResponse = await requestAsClient(baseUrl, '/api/test');
    const firstBody = await firstResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(firstBody).toEqual({
      path: '/api/test',
      method: 'GET',
    });

    const rejectedResponse = await requestAsClient(baseUrl, '/api/test');

    expect(rejectedResponse.status).toBe(429);
    expect(targetServer.getRequestCount()).toBe(1);
  });
});
