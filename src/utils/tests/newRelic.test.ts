import { resolve } from 'path';
import { describe, expect, test } from 'vitest';

import { type BuildServerNewRelicConfig } from '../../types';
import { getNewRelicScriptAndSha256 } from '../newRelic';

describe('newRelic', () => {
  describe('getNewRelicScriptAndSha256', () => {
    test('should generate the correct CSP for new relic', () => {
      const nrConfig: BuildServerNewRelicConfig = {
        applicationId: 'super-chumps',
      };

      // act
      const [_, sha] = getNewRelicScriptAndSha256(nrConfig, resolve('public'));

      // assert
      expect(sha).toEqual(`'sha256-jvIMKDq8gMTYq+8o+0bIgR0xCZl0dqH7Pw0vkLWld2E='`); // browser
    });
  });
});
