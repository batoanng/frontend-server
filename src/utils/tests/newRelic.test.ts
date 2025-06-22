import { resolve } from 'path';
import { describe, expect, test } from 'vitest';

import { type BuildServerNewRelicConfig } from '@/types';
import { getNewRelicScriptAndSha256 } from '@/utils';

describe('newRelic', () => {
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
