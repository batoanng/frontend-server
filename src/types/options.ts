import type { Request as ExpressRequest } from 'express';
import { type OnProxyResCallback } from 'http-proxy-middleware/dist/types';

export type CorsOptions = {
  /**
   * The exhaustive list of origins you would like to allow for CORS.
   */
  allowedOrigins: string[];
};

export type ProxyOptions = {
  /**
   * Optional callback to invoke after all proxied API calls have received a response.
   */
  onProxyRes?: OnProxyResCallback;
};

export type RateLimitOptions = {
  /**
   * Enable or disable the built-in rate limiter.
   * Defaults to `true`.
   */
  enabled?: boolean;

  /**
   * Number of requests allowed to leak from the bucket every second.
   * Defaults to `100`.
   */
  requestsPerSecond?: number;

  /**
   * Maximum number of queued requests the bucket can hold before new requests are rejected.
   * Defaults to the configured `requestsPerSecond`.
   */
  bucketCapacity?: number;

  /**
   * Route used to expose the current server and rate limiting diagnostics.
   * Defaults to `/details`.
   */
  detailsPath?: string;

  /**
   * Optional function used to derive the client key for rate limiting.
   * Defaults to `req.ip`.
   */
  keyGenerator?: (req: ExpressRequest) => string;
};

export type IndexHtmlOptions = {
  /**
   * Specifies an alternative name for the `index.html` file to be loaded. This may be a full path or just a file name.
   * Defaults to `index.html`.
   */
  filename?: string;

  /**
   * Window (global) variable name to inject runtime ENV settings under. Defaults to `process.env`.
   *
   * Note: this replaces the legacy `window.process = { env: {...} }` replacement script.
   */
  globalClientEnvVariableName?: string;

  /**
   * Window (global) variable name to inject JSON configuration settings under. Defaults to `__APP_CONFIG__`.
   *
   * This variable will contain the runtime configuration loaded from JSON files.
   * Example: window.__APP_CONFIG__ = { apiUrl: "https://api.example.com" }
   *
   * @default "__APP_CONFIG__"
   */
  globalJsonConfigVariableName?: string;
};
