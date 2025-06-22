import { describe, expect, test } from 'vitest';

import { createAppPathFactory } from '@/utils';

describe('createAppPathFactory', () => {
  const relativePath = 'relative/path';
  const absolutePath = '/absolute/path';

  describe('when no appPrefix is provided', () => {
    test('returns factory that echos the provided path', () => {
      // arrange
      const factory = createAppPathFactory();

      // act
      const relativeAppPath = factory(relativePath);
      const absoluteAppPath = factory(absolutePath);

      // assert
      expect(relativeAppPath).toBe(`/${relativePath}`);
      expect(absoluteAppPath).toBe(absolutePath);
    });
  });

  describe('when a clean appPrefix is provided', () => {
    test('returns factory that creates an absolute path from the appPrefix', () => {
      // arrange
      const appPrefix = 'prefix';
      const factory = createAppPathFactory(appPrefix);

      // act
      const relativeAppPath = factory(relativePath);
      const absoluteAppPath = factory(absolutePath);

      // assert
      expect(relativeAppPath).toBe(`/${appPrefix}/${relativePath}`);
      expect(absoluteAppPath).toBe(`/${appPrefix}${absolutePath}`);
    });
  });

  describe('when an absolute appPrefix is provided', () => {
    test('returns a factory that appends to the absolute appPrefix', () => {
      // arrange
      const appPrefix = '/prefix';
      const factory = createAppPathFactory(appPrefix);

      // act
      const relativeAppPath = factory(relativePath);
      const absoluteAppPath = factory(absolutePath);

      // assert
      expect(relativeAppPath).toBe(`${appPrefix}/${relativePath}`);
      expect(absoluteAppPath).toBe(`${appPrefix}${absolutePath}`);
    });
  });
});
