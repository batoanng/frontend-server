import { BuildServerNewRelicConfig } from '@server/types/newRelic';
import type { Express } from 'express';
import type { OnProxyResCallback, Response } from 'http-proxy-middleware/dist/types';

import type { CspOptions } from './csp';
import type { CorsOptions, IndexHtmlOptions, ProxyOptions } from './options';

export type BuildServerParams = {
  /**
   * The runtime environment for node. This is only used to determine which `client.env` file to load, eg.
   * `client.env.development`. Defaults to `development`.
   */
  nodeEnv?: string;

  /**
   * Override express logging to show stack traces
   * By default we turn off express stack traces in UAT and production envs, for security reasons, but you can override this by setting it to true.
   */
  enableExpressStackTraces?: boolean;

  /**
   * Prefix that your front-end app runs under. This will be used to build an API path as `${baseUrl}/${appPrefix}/api`.
   * Incoming requests to this API path will be proxied to the `targetServerUrl`. Defaults to `''`.
   */
  appPrefix?: string;

  /**
   * Specifies the URL of the server which is running the actual API for your application.
   */
  targetServerUrl: string;

  /**
   * The base path for your built client assets. Static resources will be served from this base path.
   */
  clientBuildPath: string;

  /**
   * Additional options for the index HTML page.
   */
  indexOptions?: IndexHtmlOptions;

  /**
   * Additional options to supply for the content security policy.
   */
  cspOptions?: CspOptions;

  /**
   * CORS configuration options.
   */
  corsOptions: CorsOptions;

  /**
   * Configuration options for the automatically created proxies.
   */
  proxyOptions?: ProxyOptions;

  /**
   * Configuration parameters for New Relic. If omitted, the New Relic script will not be served.
   */
  newRelic?: BuildServerNewRelicConfig;

  /**
   * An array for the allowed http methods.
   * Defaults to `['GET', 'PUT', 'PATCH', 'POST', 'DELETE']`
   */
  allowedMethods?: string[];

  /**
   * Enable JSON configuration injection into index.html
   * When true, the server will:
   * 1. Load a JSON config file based on the current environment
   * 2. Inject it as a global variable in index.html
   * 3. Add necessary CSP headers for the injected script
   * @default false
   */
  useJsonConfiguration?: boolean;

  /**
   * Optional callback to configure middleware on the Express server. If supplied, the callback is called before the
   * default path handling middlewares have been added.
   *
   * @param server The express server to be configured.
   * @param buildResponseHeaders Utility functions for buildling response headers.
   */
  configure?: (server: Express, proxyBuilder: BuildServerProxyBuilder) => void;

  /**
   * Optional array of paths to block. This works much like a traditional blacklist, if the url is in this array, it will not return anything.
   * This allows you to block some api endpoints that would exist for another system but aren't required for the frontend but can't contain the proper authentication methods to block unwanted access.
   * @example ['/api/v1/getAllUsers']
   */
  blacklistPaths?: string[];
};

export type BuildServerProxyBuilder = {
  /**
   * Utility function to set the `Content-Security-Policy` and associated headers to the configured policy for API calls.
   *
   * @param res The response object to set the header on.
   */
  setApiCsp: (res: Response) => void;

  /**
   * Default handler to invoke after a call that was proxied to the API received a response.
   *
   * See: https://github.com/http-party/node-http-proxy?tab=readme-ov-file#listening-for-proxy-events
   */
  handleProxyRes: OnProxyResCallback;
};

export type BuildServerReturn = BuildServerProxyBuilder & {
  /**
   * The server that was built.
   */
  server: Express;
};
