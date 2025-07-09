import { join } from 'path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'fs';
import { ClientEnvPluginOptions, createClientEnvFilesPlugin } from './helpers';

describe('helpers', () => {
  describe('createClientEnvFilesPlugin', () => {
    const VAR_ROOT_KEY = 'VITE_KEY_FROM_ROOT';
    const VAR_ENV_KEY = 'VITE_KEY_FROM_ENV';
    const VAR_COMMON_KEY = 'VITE_KEY_FROM_COMMON';
    const VAR_UNPREFIXED_KEY = 'SOME_OTHER_KEY';
    const DEFAULT_BUILD_PATH = 'dist';

    const validEnvironments = ['development', 'production'];
    const pathsToClean = new Map<string, boolean>();

    beforeEach(() => {
      pathsToClean.clear();
    });

    afterEach(() => {
      for (const [dir, removeDir] of pathsToClean.entries()) {
        readdirSync(dir)
          .filter((filename) => filename.startsWith('.env') || filename.startsWith('client.env'))
          .forEach((filename) => unlinkSync(join(dir, filename)));

        if (removeDir) {
          rmdirSync(dir);
        }
      }
    });

    const ensurePath = (path: string) => {
      if (existsSync(path)) {
        pathsToClean.set(path, false);
      } else {
        mkdirSync(path);
        pathsToClean.set(path, true);
      }
    };

    const generateTestEnvFiles = (envPath = '', createRootFile = false) => {
      ensurePath(envPath || '.');

      const createFilePath = (filename: string) => (envPath ? join(envPath, filename) : filename);
      const formatEnvVariables = (...variables: [string, string | boolean][]) =>
        variables.map(([key, value]) => `${key}="${value}"`).join('\n');

      if (createRootFile) {
        writeFileSync(
          createFilePath('.env'),
          formatEnvVariables(
            [VAR_ROOT_KEY, true],
            [VAR_ENV_KEY, 'no-environment'],
            [VAR_UNPREFIXED_KEY, VAR_UNPREFIXED_KEY]
          )
        );
      }

      validEnvironments.forEach((env) => {
        writeFileSync(
          createFilePath(`.env.${env}`),
          formatEnvVariables([VAR_ENV_KEY, env.toUpperCase()], [VAR_UNPREFIXED_KEY, VAR_UNPREFIXED_KEY])
        );
      });

      writeFileSync(createFilePath(`.env.common`), formatEnvVariables([VAR_COMMON_KEY, true]));
    };

    const loadEnvFile = (buildPath: string, environment: string): Record<string, string> | null => {
      const filePath = join(buildPath, `client.env.${environment}`);
      if (!existsSync(filePath)) return null;

      const fileContent = readFileSync(filePath);
      const envVariables = fileContent
        .toString()
        .split('\n')
        .map((line) => line.split('='));

      return Object.fromEntries(envVariables);
    };

    const assertClientEnvFilesExist = (
      expectedEnvironments: string[],
      buildPath: string | undefined = DEFAULT_BUILD_PATH
    ) => {
      const filesInDirectory = readdirSync(buildPath);
      const envFiles = filesInDirectory.filter((file) => file.startsWith('client.env'));
      expect(envFiles).toHaveLength(expectedEnvironments.length);

      expectedEnvironments.forEach((env) => expect(envFiles).toContain(`client.env.${env}`));
    };

    const runFolderTest = (envPath: string | undefined = undefined, buildPath: string | undefined = undefined) => {
      // arrange
      generateTestEnvFiles(envPath);
      ensurePath(buildPath ?? DEFAULT_BUILD_PATH);

      // act
      createClientEnvFilesPlugin({ validEnvironments, envPath, buildPath }).generateBundle();

      // assert
      assertClientEnvFilesExist(validEnvironments, buildPath);
    };

    test('generate the client env files using the default folders', () => runFolderTest());
    test('generate the client env files with a different src dir', () => runFolderTest('src/vite'));
    test('generate the client env files with a different build dir', () => runFolderTest(undefined, 'build'));
    test('generate the client env files with a different src and build dir', () => runFolderTest('src/vite', 'build'));

    test('do not fail if a source file is missing', () => {
      // arrange
      generateTestEnvFiles();
      ensurePath(DEFAULT_BUILD_PATH);

      // act
      createClientEnvFilesPlugin({ validEnvironments: ['pants'] }).generateBundle();

      // assert
      assertClientEnvFilesExist([]);
    });

    test('fail if a source file is missing when failOnMissing is passed', () => {
      // arrange
      generateTestEnvFiles();
      ensurePath(DEFAULT_BUILD_PATH);

      // act
      // assert
      expect(() =>
        createClientEnvFilesPlugin({ validEnvironments: ['pants'], failOnMissing: true }).generateBundle()
      ).toThrowError();
    });

    const runGlobTest = (
      glob: ClientEnvPluginOptions['glob'],
      getExpectedConfig: (environment: string) => [string, string | undefined][]
    ) => {
      generateTestEnvFiles(undefined, true);

      // act
      createClientEnvFilesPlugin({ validEnvironments, glob }).generateBundle();

      // assert
      assertClientEnvFilesExist(validEnvironments);

      validEnvironments.forEach((environment) => {
        const fileContent = loadEnvFile(DEFAULT_BUILD_PATH, environment);
        expect(fileContent).not.toBeNull();

        const expected = getExpectedConfig(environment);
        const expectedConfigCount = expected.filter(([, value]) => Boolean(value)).length;
        expect(Object.keys(fileContent!).length).toBe(expectedConfigCount);

        expected.forEach(([key, value]) => {
          if (value) {
            expect(fileContent![key]).toBe(`"${value}"`);
          } else {
            expect(fileContent![key]).toBeUndefined();
          }
        });
      });
    };

    const runBooleanGlobTest = (glob: boolean) =>
      runGlobTest(glob, (environment) => [
        [VAR_ROOT_KEY, glob ? 'true' : undefined],
        [VAR_ENV_KEY, environment!.toUpperCase()],
        [VAR_UNPREFIXED_KEY, VAR_UNPREFIXED_KEY],
        [VAR_COMMON_KEY, undefined],
      ]);

    test('globs when `glob` is true', () => runBooleanGlobTest(true));
    test('does not glob when `glob` is false', () => runBooleanGlobTest(false));

    test('globs named files when `glob` is an array', () =>
      runGlobTest(['.env', '.env.common'], (environment) => [
        [VAR_ROOT_KEY, 'true'],
        [VAR_ENV_KEY, environment!.toUpperCase()],
        [VAR_UNPREFIXED_KEY, VAR_UNPREFIXED_KEY],
        [VAR_COMMON_KEY, 'true'],
      ]));

    test('globs common file glob when `glob` is an array', () =>
      runGlobTest(
        (env: string) => ['.env.common', `.env.${env}`],
        (environment) => [
          [VAR_ROOT_KEY, undefined],
          [VAR_COMMON_KEY, 'true'],
          [VAR_ENV_KEY, environment!.toUpperCase()],
          [VAR_UNPREFIXED_KEY, VAR_UNPREFIXED_KEY],
        ]
      ));
  });
});
