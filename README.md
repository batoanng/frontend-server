# Frontend Server

[![install size](https://packagephobia.com/badge?p=%40batoanng%2Ffrontend-server)](https://packagephobia.com/result?p=%40batoanng%2Ffrontend-server)

---

Does most of the heavy-lifting for front-end `server.js` applications. Proxies all requests to the API to a target server, catering for CORS, CSP, and HSTS. Optionally forwards payment completion responses to the Forms API.

## Usage

```sh
npm install @batoanng/frontend-server # or yarn, pnpm
```

You can configure your own front-end server using code something as follows:

```ts
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { buildServer } from '@batoanng/frontend-server';

// load env
const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientBuildPath = path.join(dirname, '../build');

const env = process.env.NODE_ENV?.toLowerCase() ?? null;

if (env === null) {
  console.log('Warning: process.env.NODE_ENV is not set, using .env as the default');
}

const envFile = env === null 
  ? path.join(dirname, '.env') 
  : path.join(dirname, '.env.' + env);

dotenv.config({ path: envFile });

const { server } = buildServer({
  targetServerUrl: process.env.APP_API_TARGET_SERVER,
  nodeEnv: env,
  indexOptions: {
    filename: 'index.html',
    globalClientEnvVariableName: 'process.env',
  },
  appPrefix: process.env.APP_URL_PREFIX,
  clientBuildPath: clientBuildPath,
  cspOptions: {
    services: [
      'google-analytics',
      'google-translate',
      'newrelic',
      'hotjar',
      'full-story',
      'google-fonts',
    ],
    connectSrcElements: [
      'https://*.your-domain.com'
    ],
    scriptSrcElements: [
      "'sha256-eVzrNv8f3FKjQhflSMC3+yFtNdThPi+cT+245HpcDV0='", // non-english inline scripts for Google Translate
      "'sha256-yjCTgtivmXYtWQuObDl8BjTbkgRha9Pk2lo0RDPrymA='", // newRelic.tsx
    ]
  },
  corsOptions: {
    allowedOrigins: [process.env.REACT_APP_BASE_URL, 'http://127.0.0.1:3000']
  },
  newRelic: {
    applicationId: 'NR-123...'
  },
  rateLimitOptions: {
    requestsPerSecond: 100,
    bucketCapacity: 100,
    detailsPath: '/details',
  },
  configure: (server: Express, proxyBuilder: BuildServerProxyBuilder) => {
    // Additional configuration required for Express
    // server.set('trust proxy', true);
  },
});

const port = process.env.PORT ?? 3000;

server.listen(port, () => {
  console.log(`App Server is running on port ${port}`);
});
```

### CSP

The CSP can be modified by passing in:

* `services` - the list of "known" services to include across all the CSP directives
* `*Elements` - additional elements that will be added to the relevant CSP directive

### Automatic client-side env variable injection

Client side variables loaded from the client's `.env` files will automatically be injected into the HTML page and made available before the application scripts are executed. By default, the injection point for these variables replicates the legacy webpack method by using `window.process.env`, but this can be customized using the `indexOptions.globalClientEnvVariableName` parameter.

The relevant SHA for the script will also be generated and added to the site's CSP settings.

### Rate limiting and diagnostics

Frontend Server includes a built-in leaky-bucket rate limiter for normal application traffic. By default it allows `100` requests per second per client IP with a bucket capacity of `100`.

The limiter applies to static assets, index routes, proxied API requests, and custom routes added through `configure`. `OPTIONS` requests and `GET /health` bypass the limiter.

Runtime diagnostics are available at `GET /details`. The response includes the active limiter configuration, the number of tracked clients, and the current caller's live bucket state.

If you run behind a reverse proxy, configure Express `trust proxy` in `configure` so `req.ip` resolves to the original client IP. If you need custom client identification, provide `rateLimitOptions.keyGenerator`.

## `createClientEnvFilesPlugin`

This plugin can be included in the plugins list for vite to automatically create/copy the correct client `.env` files to the build folder, which can then be picked up by frontend server at runtime, and injected into the `index.html` file.

`.env` files can be globbed (i.e. merged) with a "common `.env` file by passing `true` to the plugin configuration. Alternatively, the `glob` setting may be passed as:

* `string[]` - An array of filenames to glob, overriding earlier files with later files, before finally including the specific file based on the environment name.
* `(validEnvironment: string) => string[]` - Allows full manual control. The glob will combine all the files named in the resulting array. The resulting file paths should be relative to the `envPath` setting.
