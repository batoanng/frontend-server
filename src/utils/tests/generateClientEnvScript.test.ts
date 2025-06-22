import { describe, expect, test } from 'vitest';

import { generateClientEnvScript } from '@/utils';

describe('generateClientEnvScript', () => {
  const envVariables: Record<string, string> = { env: 'test' };

  describe('when given a single-part variable name', () => {
    test('should assign the variable directly to window', () => {
      // arrange
      const variableName = 'globalEnvConfig';

      // act
      const envScript = generateClientEnvScript(variableName, envVariables);

      // assert
      expect(envScript).toBe(`window["${variableName}"]=${JSON.stringify(envVariables)};`);
    });
  });

  describe('when given a two-part variable name', () => {
    test('should assign the directly to a two-part variable', () => {
      // arrange
      const variableName = 'globals.config';

      // act
      const envScript = generateClientEnvScript(variableName, envVariables);

      // assert
      expect(envScript).toBe(`window["globals"]={"config":${JSON.stringify(envVariables)}};`);
    });
  });

  describe('when given a three-part variable name', () => {
    test('should assign the variable to a three-part variable', () => {
      // arrange
      const variableName = 'globals.config.env';

      // act
      const envScript = generateClientEnvScript(variableName, envVariables);

      // assert
      expect(envScript).toBe(`window["globals"]={"config":{"env":${JSON.stringify(envVariables)}}};`);
    });
  });
});
