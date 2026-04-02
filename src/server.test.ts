import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import type { Request as ExpressRequest } from 'express';
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { afterEach, describe, expect, test } from 'vitest';

import { buildServer } from '@/server';
import { cspApiElements } from '@/constants';
import type { BuildServerParams } from '@/types';

const runningServers: HttpServer[] = [];
const tempDirectories: string[] = [];

type BuildPathOptions = {
  includeClientEnv?: boolean;
  includeIndexHtml?: boolean;
  indexHtml?: string;
  additionalFiles?: Record<string, string>;
};

type TargetServerOptions = {
  headers?: Record<string, string>;
};

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

const createClientBuildPath = ({
  includeClientEnv = true,
  includeIndexHtml = true,
  indexHtml = '<html><head></head><body><script src="/app.js"></script></body></html>',
  additionalFiles = {},
}: BuildPathOptions = {}) => {
  const buildPath = mkdtempSync(join(tmpdir(), 'frontend-server-'));
  tempDirectories.push(buildPath);

  if (includeIndexHtml) {
    writeFileSync(join(buildPath, 'index.html'), indexHtml);
  }
  writeFileSync(join(buildPath, 'app.js'), 'console.log("frontend-server");');

  if (includeClientEnv) {
    writeFileSync(join(buildPath, 'client.env.development'), 'VITE_RUNTIME_FLAG="enabled"\n');
  }

  Object.entries(additionalFiles).forEach(([filename, content]) => {
    const outputPath = join(buildPath, filename);
    const directory = dirname(outputPath);
    mkdirSync(directory, { recursive: true });
    writeFileSync(outputPath, content);
  });

  return buildPath;
};

const startTargetServer = async ({ headers = {} }: TargetServerOptions = {}) => {
  let requestCount = 0;

  const server = createHttpServer((req, res) => {
    requestCount += 1;
    res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
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

const startFrontendServer = async (
  overrides: Partial<BuildServerParams> = {},
  {
    buildPathOptions,
    targetServerOptions,
  }: {
    buildPathOptions?: BuildPathOptions;
    targetServerOptions?: TargetServerOptions;
  } = {}
) => {
  const targetServer = await startTargetServer(targetServerOptions);
  const clientBuildPath = createClientBuildPath(buildPathOptions);

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
  test('throws for invalid server options before startup', () => {
    expect(() =>
      buildServer({
        targetServerUrl: 'http://example.test',
        clientBuildPath: '/tmp/frontend-server',
        corsOptions: {
          allowedOrigins: [],
        },
      })
    ).toThrow('corsOptions.allowedOrigins cannot be empty');

    expect(() =>
      buildServer({
        targetServerUrl: 'http://example.test',
        clientBuildPath: '/tmp/frontend-server',
        corsOptions: {
          allowedOrigins: ['*'],
        },
        rateLimitOptions: {
          requestsPerSecond: 0,
        },
      })
    ).toThrow('rateLimitOptions.requestsPerSecond must be a positive number.');

    expect(() =>
      buildServer({
        targetServerUrl: 'http://example.test',
        clientBuildPath: '/tmp/frontend-server',
        corsOptions: {
          allowedOrigins: ['*'],
        },
        rateLimitOptions: {
          bucketCapacity: 0,
        },
      })
    ).toThrow('rateLimitOptions.bucketCapacity must be a positive number.');

    expect(() =>
      buildServer({
        targetServerUrl: 'http://example.test',
        clientBuildPath: '/tmp/frontend-server',
        corsOptions: {
          allowedOrigins: ['*'],
        },
        rateLimitOptions: {
          detailsPath: 'details',
        },
      })
    ).toThrow('rateLimitOptions.detailsPath must start with "/"');
  });

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

  test('supports a custom details path with the limiter disabled', async () => {
    const { baseUrl } = await startFrontendServer({
      rateLimitOptions: {
        enabled: false,
        detailsPath: '/status',
      },
    });

    const response = await fetch(`${baseUrl}/status`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rateLimit.enabled).toBe(false);
    expect(body.rateLimit.trackedClientCount).toBe(0);
    expect(body.rateLimit.currentClient.accepted).toBe(0);
    expect(body.rateLimit.currentClient.rejected).toBe(0);
    expect(body.rateLimit.currentClient.remainingApprox).toBe(100);
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

  test('serves prefixed routes and rewrites prefixed api calls', async () => {
    const { baseUrl, targetServer } = await startFrontendServer(
      {
        appPrefix: '/portal',
        rateLimitOptions: {
          enabled: false,
        },
      },
      {
        buildPathOptions: {
          additionalFiles: {
            'nested/info.txt': 'prefixed asset',
          },
        },
      }
    );

    const indexResponse = await fetch(`${baseUrl}/portal`);
    const assetResponse = await fetch(`${baseUrl}/portal/nested/info.txt`);
    const apiResponse = await fetch(`${baseUrl}/portal/api/test`);

    expect(indexResponse.status).toBe(200);
    expect(await assetResponse.text()).toBe('prefixed asset');
    expect(await apiResponse.json()).toEqual({
      path: '/api/test',
      method: 'GET',
    });
    expect(targetServer.getRequestCount()).toBe(1);
  });

  test('returns 405 for methods outside the allowed methods list', async () => {
    const { baseUrl } = await startFrontendServer({
      allowedMethods: ['GET'],
      rateLimitOptions: {
        enabled: false,
      },
    });

    const response = await requestAsClient(baseUrl, '/health', 'client-a', {
      method: 'POST',
    });

    expect(response.status).toBe(405);
    expect(await response.text()).toBe('Method Not Allowed');
  });

  test('applies CORS headers for allowed origins', async () => {
    const { baseUrl } = await startFrontendServer({
      corsOptions: {
        allowedOrigins: ['http://allowed.example'],
      },
      rateLimitOptions: {
        enabled: false,
      },
    });

    const response = await fetch(`${baseUrl}/details`, {
      headers: {
        Origin: 'http://allowed.example',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://allowed.example');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
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

  test('runs configure before default routes and exposes proxy response hooks', async () => {
    const { baseUrl } = await startFrontendServer(
      {
        corsOptions: {
          allowedOrigins: ['http://allowed.example'],
        },
        rateLimitOptions: {
          enabled: false,
        },
        proxyOptions: {
          onProxyRes: (_proxyRes, _req, res) => {
            res.set('x-proxy-hook', 'called');
          },
        },
        configure: (server, proxyBuilder) => {
          server.get('/configured', (_req, res) => {
            proxyBuilder.setApiCsp(res);
            res.send('configured');
          });

          server.get('/health', (_req, res) => {
            res.send('Configured Healthy');
          });
        },
      },
      {
        targetServerOptions: {
          headers: {
            'access-control-allow-origin': '*',
          },
        },
      }
    );

    const allowedOrigin = 'http://allowed.example';
    const configuredResponse = await fetch(`${baseUrl}/configured`);
    const healthResponse = await fetch(`${baseUrl}/health`);
    const proxyResponse = await fetch(`${baseUrl}/api/test`, {
      headers: {
        Origin: allowedOrigin,
      },
    });

    expect(await configuredResponse.text()).toBe('configured');
    expect(configuredResponse.headers.get('content-security-policy')).toBe(cspApiElements.join('; '));
    expect(await healthResponse.text()).toBe('Configured Healthy');
    expect(proxyResponse.headers.get('content-security-policy')).toBe(cspApiElements.join('; '));
    expect(proxyResponse.headers.get('x-proxy-hook')).toBe('called');
    expect(proxyResponse.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(proxyResponse.headers.get('cache-control')).toContain('no-store');
  });

  test('serves json config when runtime json configuration is enabled', async () => {
    const { baseUrl } = await startFrontendServer(
      {
        useJsonConfiguration: true,
        indexOptions: {
          globalJsonConfigVariableName: '__RUNTIME_CONFIG__',
        },
        rateLimitOptions: {
          enabled: false,
        },
      },
      {
        buildPathOptions: {
          additionalFiles: {
            'config.development.json': JSON.stringify({ apiUrl: 'https://api.example.com', featureFlag: true }),
          },
        },
      }
    );

    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('window["__RUNTIME_CONFIG__"]={"apiUrl":"https://api.example.com","featureFlag":true};');
  });

  test('continues to serve the page when the client env file is missing', async () => {
    const { baseUrl } = await startFrontendServer(
      {
        rateLimitOptions: {
          enabled: false,
        },
      },
      {
        buildPathOptions: {
          includeClientEnv: false,
        },
      }
    );

    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('window["process"]={"env":{"NODE_ENV":"production","APP_ENV":"development"}};');
  });

  test('falls back to the default error page when index.html cannot be loaded', async () => {
    const { baseUrl } = await startFrontendServer(
      {
        rateLimitOptions: {
          enabled: false,
        },
      },
      {
        buildPathOptions: {
          includeIndexHtml: false,
        },
      }
    );

    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Unable to load the page you requested');
  });

  test('rejects blacklisted paths before proxying the request', async () => {
    const { baseUrl, targetServer } = await startFrontendServer({
      blacklistPaths: ['/api/blocked'],
      rateLimitOptions: {
        enabled: false,
      },
    });

    const response = await fetch(`${baseUrl}/api/blocked`);

    expect(response.status).toBe(500);
    expect(targetServer.getRequestCount()).toBe(0);
  });
});
