import { describe, expect, test } from 'vitest';

import { CspElement } from '@/types';
import { createPolicy, generateCsp, generateCspSha256 } from '@/utils';

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
      const expectedPolicies =
        "default-src 'self'; script-src-elem 'self' 'pants'; script-src 'self'; style-src 'self'; style-src-elem 'self' 'unsafe-inline' https://cloud.typography.com; font-src 'self'; img-src 'self' data:; manifest-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; object-src 'none'";

      expect(result).toEqual(expectedPolicies);
    });

    test('should ignore carriage returns when generating a sha', () => {
      expect(generateCspSha256('line-one\r\nline-two')).toBe(generateCspSha256('line-one\nline-two'));
    });

    test('should include configured services and dynamic script shas', () => {
      const result = generateCsp(
        {
          services: ['google-analytics', 'google-fonts'],
          scriptSrcElements: ['https://cdn.example.com'],
          connectSrcElements: ['https://api.example.com'],
        },
        `'sha256-dynamic-one'`,
        undefined,
        null,
        `'sha256-dynamic-two'`
      );

      expect(result).toContain(`https://www.googletagmanager.com`);
      expect(result).toContain(`https://*.google-analytics.com`);
      expect(result).toContain(`https://fonts.googleapis.com`);
      expect(result).toContain(`'sha256-dynamic-one'`);
      expect(result).toContain(`'sha256-dynamic-two'`);
      expect(result).toContain(`https://cdn.example.com`);
      expect(result).toContain(`https://api.example.com`);
    });
  });
});
