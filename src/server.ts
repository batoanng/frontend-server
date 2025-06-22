import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { type IncomingMessage, type OutgoingHttpHeader } from 'http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { type Request, type Response } from 'http-proxy-middleware/dist/types';
import { contentType } from 'mime-types';
import { extname, join } from 'path';

import { cspApiElements, defaultAllowedMethods } from '@/constants';
import { type BuildServerParams, type BuildServerReturn } from '@/types';
import {
  createAppPathFactory,
  generateClientEnvScript,
  generateCsp,
  generateCspSha256,
  getNewRelicScriptAndSha256,
  loadIndexHtml,
} from '@/utils';

export const buildServer = (params: BuildServerParams): BuildServerReturn => {
  validateOptions();

  const {
    nodeEnv = 'development',
    enableExpressStackTraces = false,
    appPrefix = '',
    targetServerUrl,
    clientBuildPath,
    indexOptions = {},
    cspOptions = {},
    corsOptions,
    proxyOptions = {},
    newRelic,
    allowedMethods = defaultAllowedMethods,
    useJsonConfiguration = false,
    configure,
    blacklistPaths = [],
  } = params;

  const disableStackTraces = !enableExpressStackTraces || /prod|uat/i.test(nodeEnv);

  const server = express();
  server.disable('x-powered-by');

  if (disableStackTraces) {
    // this tells express to disable stack traces
    process.env.NODE_ENV = 'production';
  }

  const buildAppPath = createAppPathFactory(appPrefix);

  const [clientEnvCode, clientEnvSha] = getClientEnvCode(indexOptions.globalClientEnvVariableName);
  const [jsonConfigCode, jsonConfigSha] = getJsonConfigCode(
    useJsonConfiguration,
    indexOptions.globalJsonConfigVariableName ?? '__APP_CONFIG__'
  );
  const [newRelicScript, newRelicSha] = getNewRelicScriptAndSha256(newRelic);

  const contentSecurityPolicy = generateCsp(cspOptions, clientEnvSha, jsonConfigSha, newRelicSha);

  server.use(
    cors({
      origin: checkCorsOrigin,
      credentials: true,
      methods: allowedMethods,
    })
  );

  server.options(
    '*',
    cors({
      origin: checkCorsOrigin,
      credentials: true,
    })
  );

  // Only allow the server to handle accepted http methods
  server.use((req, res, next) => {
    if (!allowedMethods.includes(req.method)) return res.status(405).end('Method Not Allowed');
    return next();
  });

  // Always set the CSP and HSTS headers for all requests
  server.use(function (_, res, next) {
    res.removeHeader('X-Powered-By');

    // HSTS
    res.set('Strict-Transport-Security', 'max-age=31536000');

    // Note: CSP header is really only applicable on the index.html page, but we're adding it here "just in case".
    // From https://www.w3.org/TR/CSP2/#which-policy-applies, if a resource does not create a new execution context
    // (for example, when including a script, image, or stylesheet into a document), then any policies delivered with that
    // resource are discarded without effect. Its execution is subject to the policy or policies of the including context.
    res.set('Content-Security-Policy', contentSecurityPolicy);

    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer-when-downgrade');

    next();
  });

  if (blacklistPaths.length > 0) {
    // reject any api calls made to an endpoint listed in the blacklistPaths array
    server.use(function (req, res, next) {
      if (blacklistPaths.includes(req.path)) {
        throw new Error('Path blacklisted');
      }
      next();
    });
  }

  // Allow the caller to customize the server middleware before the default handlers are added since Express
  // doesn't allow overriding paths once they have been registered.
  configure?.(server, {
    setApiCsp,
    handleProxyRes,
  });

  const apiKey = buildAppPath('/api');
  server.use(
    apiKey,
    createProxyMiddleware({
      changeOrigin: true,
      target: targetServerUrl,
      pathRewrite: {
        [apiKey]: '/api',
      },
      logLevel: 'debug',
      onProxyRes: (proxyRes, req, res) => {
        // Prevent caching of API responses - this was a Red Cursor suggestion
        res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');

        handleProxyRes(proxyRes, req, res);
      },
    })
  );

  // Home page
  // Combine all scripts
  const indexHtml = loadIndexHtml(
    indexOptions.filename,
    clientBuildPath,
    clientEnvCode,
    jsonConfigCode,
    newRelicScript
  );

  // Adds a health check for kubernetes to check
  server.get('/health', (req, res) => {
    res.send('Healthy');
  });

  server.get(['/index.html', '/', appPrefix], (_, res) => {
    writeIndexHtml(res);
  });

  // Default handler. Attempt to serve requested resource from file system.
  server.get('*', async (req, res) => {
    const resourceRelativePath = getResourceRelativePath(req.path);
    const [sr, mimeType] = await staticResource(resourceRelativePath);
    if (sr == null) {
      // Fall back to the index.html if not found, so the React app can load and process the route.
      return writeIndexHtml(res);
    }

    res.writeHead(200, { 'Content-Type': mimeType as OutgoingHttpHeader });
    res.end(sr);
  });

  return { server, setApiCsp, handleProxyRes };

  function getJsonConfigCode(useJson: boolean, globalVarName: string): [string, string] {
    if (!useJson) return ['', ''];

    try {
      const configFilePath = join(clientBuildPath, `config.${nodeEnv}.json`);
      const rawConfig = readFileSync(configFilePath, 'utf8');

      // Create a single-line script content without extra whitespace
      const scriptContent = `window["${globalVarName}"]=${JSON.stringify(JSON.parse(rawConfig))};`;

      // Create single-line script tag without extra whitespace
      const configScript = `<script id="global-config-settings" type="text/javascript">${scriptContent}</script>`;

      return [configScript, generateCspSha256(scriptContent)];
    } catch (err) {
      console.error(`Failed to load JSON config: ${err}`);
      return ['', ''];
    }
  }

  function validateOptions() {
    if (params.corsOptions.allowedOrigins == null || params.corsOptions.allowedOrigins.length === 0) {
      throw new Error(`corsOptions.allowedOrigins cannot be empty. Use '*' to allow all cross-origin requests.`);
    }

    console.log(`Starting frontend-server with parameters: ${JSON.stringify(params, null, '  ')}`);
  }

  function getClientEnvCode(globalVariableName = 'process.env'): [string, string] {
    const clientEnvFilename = join(clientBuildPath, `client.env.${nodeEnv}`);
    const fileExists = existsSync(clientEnvFilename);

    // Even if the client env file is missing this might not be fatal (there may be no settings to inject),
    // so we don't need to stop here.
    const log = fileExists ? console.log : console.warn;
    log(`Injecting client env settings from ${clientEnvFilename}${fileExists ? '' : ' [MISSING]'}`);

    const clientEnvSettings = dotenv.config({ path: clientEnvFilename });

    const json: Record<string, string> = {
      NODE_ENV: 'production',
      APP_ENV: nodeEnv,
    };

    for (const k in clientEnvSettings.parsed) {
      json[k] = clientEnvSettings.parsed[k];
    }

    const clientEnvScript = generateClientEnvScript(globalVariableName, json);
    return [clientEnvScript, generateCspSha256(clientEnvScript)];
  }

  function checkCorsOrigin(
    origin: string | undefined,
    callback: (error: Error | null, origin: string | boolean) => void
  ) {
    // Some requests (e.g. curl requests, or requests from the same origin) will have no 'origin' header and
    // are allowed through.
    const allowAll = !origin || corsOptions.allowedOrigins.includes('*');
    if (allowAll) {
      return callback(null, '*');
    }

    if (corsOptions.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const msg = `The CORS policy for this site does not allow access from the specified origin: ${origin}`;
    return callback(new Error(msg), false);
  }

  function setApiCsp(res: Response) {
    return res.set('Content-Security-Policy', cspApiElements.join('; '));
  }

  function handleProxyRes(proxyRes: IncomingMessage, req: Request, res: Response) {
    delete proxyRes.headers['access-control-allow-origin'];
    setApiCsp(res);

    proxyOptions?.onProxyRes?.(proxyRes, req, res);
  }

  async function staticResource(resourceName: string): Promise<[string | Buffer, string] | []> {
    const fileName = join(clientBuildPath, resourceName);
    try {
      const mimeType = staticResourceMimetype(resourceName).toString();
      const encoding = mimeType.includes('text') || mimeType.includes('json') ? 'utf8' : null;
      const file = await readFile(fileName, encoding);
      return [file, mimeType];
    } catch (err) {
      console.error({ err });
      return [];
    }
  }

  function staticResourceMimetype(resourceName: string) {
    const fileName = join(clientBuildPath, resourceName);
    return contentType(extname(fileName));
  }

  function getResourceRelativePath(url: string) {
    if (!appPrefix) return url;
    if (url.startsWith(appPrefix)) return url.substring(appPrefix.length);

    const urlParts = url.split(appPrefix || '/');
    const relativeUri = [...urlParts].pop();
    return decodeURI(relativeUri as string);
  }

  function writeIndexHtml(res: Response) {
    res.writeHead(200, {
      'Content-Type': 'text/html',
    });
    res.end(indexHtml);
  }
};
