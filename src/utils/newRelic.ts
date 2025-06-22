import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { type BuildServerNewRelicConfig, type NewRelicConfig } from '@/types';
import { generateCspSha256 } from '@/utils';

export const getNewRelicScriptAndSha256 = (
  config?: BuildServerNewRelicConfig,
  scriptSrcDir?: string
): [string, string] | [] => {
  const scriptContent = getNewRelicScriptContent(config, scriptSrcDir);

  if (!scriptContent) return [];

  return [`<script id="new-relic" type="text/javascript">${scriptContent}</script>`, generateCspSha256(scriptContent)];
};

const getNewRelicScriptContent = (config?: BuildServerNewRelicConfig, scriptSrcDir?: string) => {
  const nrConfig = validateConfig(config);
  if (!nrConfig) return null;

  const moduleDirname = scriptSrcDir ?? dirname(fileURLToPath(import.meta.url));
  const nrScriptPath = resolve(moduleDirname, './scripts/newRelic.js');
  const nrScript = readFileSync(nrScriptPath).toString();

  // Wrap the script in an IIFE so that we can pass in the config parameters
  return `((nrConfig) => { ${nrScript} })(${JSON.stringify(nrConfig)});`;
};

function validateConfig(config?: BuildServerNewRelicConfig): NewRelicConfig | null {
  if (!config) return null;

  const { applicationId, accountId, trustKey, licenceKey } = config;
  const emptyKeys = [applicationId, accountId, trustKey, licenceKey].filter((value) => !value);

  if (emptyKeys.length) {
    console.warn('Invalid NewRelic configuration', config);
    return null;
  }

  return {
    applicationId,
    accountId: accountId!,
    trustKey: trustKey!,
    licenceKey: licenceKey!,
    agentId: config.agentId ?? config.applicationId,
  };
}
