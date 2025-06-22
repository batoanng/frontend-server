
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
  onProxyRes?: Function;
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
