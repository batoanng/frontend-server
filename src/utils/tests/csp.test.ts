import { describe, expect, test } from 'vitest';

import { CspElement } from '../../types';
import { createPolicy, generateCsp } from '../csp';

export const mockElements: CspElement[] = [
  { element: 'script-src-elem' },
  { element: "'self'" },
  { element: 'https://translate.google.com', service: 'google-translate' },
  { element: 'https://translate.googleapis.com', service: 'google-translate' },
  { element: 'https://translate-pa.googleapis.com', service: 'google-translate' },
  { element: 'https://www.googletagmanager.com', service: 'google-analytics' },
  { element: 'https://static.hotjar.com', service: 'hotjar' },
  { element: 'https://script.hotjar.com', service: 'hotjar' },
  { element: 'https://js-agent.newrelic.com', service: 'newrelic' },
  { element: 'https://bam.nr-data.net', service: 'newrelic' },
];

describe('csp', () => {
  describe('createPolicy', () => {
    test('should add nominated services to include into the CSP policy', () => {
      const result = createPolicy(mockElements, ['hotjar', 'newrelic']);

      const expectedGlobal = mockElements.filter((element) => element.service === undefined);
      const expectedHotJar = mockElements.filter((element) => element.service === 'hotjar');
      const expectedNewRelic = mockElements.filter((element) => element.service === 'newrelic');
      const expectedResult = [...expectedGlobal, ...expectedHotJar, ...expectedNewRelic]
        .map(({ element }) => element)
        .join(' ');

      expect(result).toEqual(expectedResult);
    });

    test('should filter policy based on services', () => {
      const additionalPolicy = ['additional'];
      const result = createPolicy(mockElements, [], additionalPolicy);

      const expectedPolicy = mockElements
        .filter((element) => element.service === undefined)
        .map(({ element }) => element)
        .concat(additionalPolicy)
        .join(' ');

      expect(result).toEqual(expectedPolicy);
    });
  });

  describe('generateCsp', () => {
    test('should generate the default policy', () => {
      // arrange
      const clientEnvSha = `'pants'`;

      // act
      const result = generateCsp({}, clientEnvSha);

      // assert
      const expectedPolicies = [
        `default-src 'self'`,
        `script-src-elem 'self' ${clientEnvSha}`,
        `style-src 'self'`,
        `img-src 'self' data:`,
        `manifest-src 'self' data:`,
        `connect-src 'self'`,
        `frame-src 'self'`,
        `frame-ancestors 'none'`,
        `object-src 'none'`,
      ];

      expect(result).toEqual(expectedPolicies.join('; '));
    });
  });
});
