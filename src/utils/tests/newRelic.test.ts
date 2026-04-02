import { resolve } from 'path';
import { describe, expect, test } from 'vitest';

import { type BuildServerNewRelicConfig } from '@/types';
import { getNewRelicScriptAndSha256 } from '@/utils';

describe('newRelic', () => {
  test('should not generate a script when config is omitted', () => {
    expect(getNewRelicScriptAndSha256()).toEqual([]);
  });

  describe('getNewRelicScriptAndSha256', () => {
    test('should generate the correct CSP for new relic', () => {
      const nrConfig: BuildServerNewRelicConfig = {
        applicationId: 'super-chumps',
        agentId: 'agentId',
        accountId: 'accountId',
        trustKey: 'trustKey',
        licenceKey: 'licenceKey',
      };

      // act
      const [_, sha] = getNewRelicScriptAndSha256(nrConfig, resolve('public'));

      // assert
      expect(sha).toEqual(`'sha256-Q4PvT/K2bUq8s92vUEeMKWDJQiSjx5uvmEiCQs5iy6E='`);
    });

    test('should default the agent id to the application id when omitted', () => {
      const nrConfig: BuildServerNewRelicConfig = {
        applicationId: 'super-chumps',
        accountId: 'accountId',
        trustKey: 'trustKey',
        licenceKey: 'licenceKey',
      };

      const [script] = getNewRelicScriptAndSha256(nrConfig, resolve('public'));

      expect(script).toContain('id="new-relic"');
      expect(script).toContain('"applicationId":"super-chumps"');
      expect(script).toContain('"agentId":"super-chumps"');
    });
  });

  test('should not generate CSP for invalid config', () => {
    const nrConfig: BuildServerNewRelicConfig = {
      applicationId: 'super-chumps',
      agentId: 'agentId',
      accountId: 'accountId',
      // trustKey: "trustKey", this field is missing
      // licenceKey: "licenceKey" this field is missing
    };

    // act
    const [_, sha] = getNewRelicScriptAndSha256(nrConfig, resolve('public'));

    // assert
    expect(sha).toBeUndefined();
  });
});
