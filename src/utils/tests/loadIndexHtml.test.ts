import { PathLike, PathOrFileDescriptor, existsSync, readFileSync } from 'fs';
import path from 'path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { generateCspSha256 } from '../csp';
import { loadIndexHtml } from '../loadIndexHtml';

vi.mock('fs');

describe('loadIndexHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when passed a filename', () => {
    const setupIndexHtmlFile = (expectedPath: string) => {
      vi.mocked(existsSync).mockImplementation((filename: PathLike) => filename === expectedPath);
      vi.mocked(readFileSync).mockImplementation((filename: PathOrFileDescriptor) => {
        if (filename === expectedPath) return filename;
        throw new Error('File does not exists: ' + filename);
      });
    };

    test('should load the filename if it is a full path', () => {
      const filePath = '/full/path/to/filename.html';
      setupIndexHtmlFile(filePath);

      const result = loadIndexHtml(filePath, '.', '');

      expect(result).toEqual(filePath);
    });

    test('should load the file from the build path', () => {
      const configuredFileName = 'index.dev.html';
      const clientBuildPath = path.normalize('/build/path');
      const expectedFilename = path.join(clientBuildPath, configuredFileName);
      setupIndexHtmlFile(expectedFilename);

      const result = loadIndexHtml(configuredFileName, clientBuildPath, '');

      expect(result).toEqual(expectedFilename);
    });

    test('should load the file from the default path if it does not exist', () => {
      const clientBuildPath = path.normalize('/build/path');
      setupIndexHtmlFile(path.join(clientBuildPath, 'index.html'));

      const configuredFileName = 'index.dev.html';
      const result = loadIndexHtml(configuredFileName, clientBuildPath, '');

      expect(result).toEqual(path.join(clientBuildPath, 'index.html'));
    });
  });

  describe('when passed clientEnvCode', () => {
    test('legacy client env code is removed from the HTML', () => {
      const legacyScript = `<script id="legacy-env-code" type="text/javascript">window.process = { env: { VITE_ENVIRONMENT: "production" } }</script>`;
      const otherScript = `<script id="some-other-script" type="text/javascript">alert('pants')</script>`;

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(legacyScript + otherScript);

      const result = loadIndexHtml('mock.html', 'mock/path', 'client-env-code');

      expect(result).toBe(otherScript);
    });

    test('client env code is injected before the closing head tag', () => {
      const clientEnvCode = 'client-env-code';

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('<head></head>');

      const result = loadIndexHtml('mock.html', 'mock/path', clientEnvCode);

      expect(result).toBe(
        `<head><script id="global-env-settings" type="text/javascript">${clientEnvCode}</script></head>`
      );
    });

    test('client env code is injected before other scripts', () => {
      const clientEnvCode = 'client-env-code';

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('<head><script id="other-script"></script></head>');

      const result = loadIndexHtml('mock.html', 'mock/path', clientEnvCode);

      expect(result).toBe(
        `<head><script id="global-env-settings" type="text/javascript">${clientEnvCode}</script><script id="other-script"></script></head>`
      );
    });
  });

  describe('when passed multiple scripts', () => {
    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
    });

    test('should inject multiple scripts with proper separation', () => {
      const clientEnvCode = 'window["process"]={"env":{"NODE_ENV":"production"}};';
      const jsonConfigCode = `<script id="global-config-settings" type="text/javascript">
        window["__APP_CONFIG__"] = {"apiUrl":"https://api.example.com"};
      </script>`;
      const newRelicScript = '<script>console.log("newrelic")</script>';

      vi.mocked(readFileSync).mockReturnValue('<head><script id="other-script"></script></head>');

      const result = loadIndexHtml('mock.html', 'mock/path', clientEnvCode, jsonConfigCode, newRelicScript);

      // Verify scripts are properly separated
      expect(result).toContain('<script id="global-env-settings"');
      expect(result).toContain('<script id="global-config-settings"');
      expect(result).not.toContain('script>window["__APP_CONFIG__"]</script>');
      expect(result).toMatch(/<script[^>]*>[^<]*<\/script>/g);

      // Verify order of scripts
      const scriptOrder = result.match(/<script[^>]*>[^<]*<\/script>/g);
      expect(scriptOrder?.[0]).toContain('global-env-settings');
      expect(scriptOrder?.[1]).toContain('global-config-settings');
      expect(scriptOrder?.[2]).toContain('newrelic');
    });

    test('should handle undefined or null scripts', () => {
      const clientEnvCode = 'window["process"]={"env":{"NODE_ENV":"production"}};';
      const undefinedScript = undefined;
      const nullScript = null;

      vi.mocked(readFileSync).mockReturnValue('<head></head>');

      const result = loadIndexHtml('mock.html', 'mock/path', clientEnvCode, undefinedScript, nullScript);

      // Should only contain the env script
      expect(result).toBe(
        `<head><script id="global-env-settings" type="text/javascript">${clientEnvCode}</script></head>`
      );
    });

    test('should preserve script attributes when injecting', () => {
      const clientEnvCode = 'window["process"]={"env":{"NODE_ENV":"production"}};';
      const jsonConfigCode = `<script id="global-config-settings" type="text/javascript" defer>
        window["__APP_CONFIG__"] = {"apiUrl":"https://api.example.com"};
      </script>`;

      vi.mocked(readFileSync).mockReturnValue('<head></head>');

      const result = loadIndexHtml('mock.html', 'mock/path', clientEnvCode, jsonConfigCode);

      // Verify script attributes are preserved
      expect(result).toContain('type="text/javascript"');
      expect(result).toContain('defer');
      expect(result).toContain('id="global-config-settings"');
    });

    test('should maintain proper script tag closing', () => {
      const clientEnvCode = 'window["process"]={"env":{"NODE_ENV":"production"}};';
      const jsonConfigCode = `<script id="global-config-settings">window["__APP_CONFIG__"]={};</script>`;

      vi.mocked(readFileSync).mockReturnValue('<head></head>');

      const result = loadIndexHtml('mock.html', 'mock/path', clientEnvCode, jsonConfigCode);

      // Count opening and closing script tags
      const openingTags = (result.match(/<script/g) || []).length;
      const closingTags = (result.match(/<\/script>/g) || []).length;

      expect(openingTags).toBe(2); // One for env, one for config
      expect(closingTags).toBe(2); // Should match opening tags
      expect(openingTags).toBe(closingTags);
    });
  });
  describe('JSON Config Script Generation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(existsSync).mockReturnValue(true);
    });

    const mockConfig = {
      appId: 'google',
      apiUrl: 'https://google.com',
      appUrlPrefix: '/google',
      environment: 'sit',
      useProfileConnect: true,
      logoutUrlOverride: 'https://myservicensw-account-ui.staging.my.testservicensw.net/api/auth/logout',
      serviceNswAccountUrl: 'https://myservicensw-account-ui.staging.my.testservicensw.net/',
      authority: 'https://api-psm.g.testservicensw.net/.well-known/openid-configuration',
      oidcs: [
        {
          clientId: '6xIPhGodliFs1WgPLTZe3DmNDQeuAX7L',
          matchPath: '/',
        },
        {
          clientId: '6xIPhGodliFs1WgPLTZe3DmNDQeuAX7L',
          matchPath: '/industry-participant',
        },
      ],
    };

    test('should generate a single-line script without extra whitespace', () => {
      // Mock the config file read
      vi.mocked(readFileSync).mockImplementation((filepath: PathOrFileDescriptor) => {
        if (typeof filepath === 'string' && filepath.includes('config.development.json')) {
          return JSON.stringify(mockConfig, null, 2);
        }
        // Return a proper HTML template for index.html
        return '<html><head><title>Test</title></head><body></body></html>';
      });

      const clientEnvCode = 'window["process"]={"env":{"NODE_ENV":"production"}};';
      const expectedConfigScript = `window["__APP_CONFIG__"]=${JSON.stringify(mockConfig)};`;

      const result = loadIndexHtml(
        'mock.html',
        'mock/path',
        clientEnvCode,
        `<script id="global-config-settings" type="text/javascript">${expectedConfigScript}</script>`
      );

      // Verify the script is injected as a single line
      expect(result).not.toContain('\n      window');
      expect(result).not.toContain('  "appId"');

      // Verify correct script tag attributes
      expect(result).toContain('<script id="global-config-settings" type="text/javascript">');

      // Verify content is single line
      const scriptContent = result.match(/<script id="global-config-settings"[^>]*>(.*?)<\/script>/)?.[1];
      expect(scriptContent?.includes('\n')).toBe(false);

      // Verify SHA generation matches
      const generatedEnvSha = generateCspSha256(clientEnvCode);
      expect(generatedEnvSha).toBe(`'sha256-OIzt0JrnQ7zN+Q2ZsgJ/NeLWBVAg0qWNuRx5bvBTGkU='`);
      const generatedConfigSha = generateCspSha256(expectedConfigScript);
      expect(generatedConfigSha).toBe(`'sha256-r9YrHntqKnp3hfkuFbfBTrAy+swEFN6IRP7F6Rtnxgo='`);
    });
  });
});
