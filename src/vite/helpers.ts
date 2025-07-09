import { parse, populate } from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, normalize } from 'path';

export interface ClientEnvPluginOptions {
  /**
   * Defines the environmental `.env` files to copy (e.g. [`sit`, `uat`] to copy `.env.sit` and `.env.uat`.
   */
  validEnvironments: string[];

  /**
   * Forces the plugin to fail if one of the `.env` files specified is missing. Defaults to `false`.
   */
  failOnMissing?: boolean;

  /**
   * The path to find the `.env` files. Defaults to `null` (i.e. the current folder).
   */
  envPath?: string;

  /**
   * The build folder to copy the files into.
   *
   * @deprecated Use `buildPath` instead. This has been renamed to be consistent with `envPath`.
   */
  buildFolderName?: string;

  /**
   * The path to copy the files into. Defaults to `dist`.
   */
  buildPath?: string;

  /**
   * Should .env files be globbed before being copied? (i.e. should we try to load `.env` as a base and then load
   * `.env.sit` on top of it, in order to create the `client.env.sit` file).
   *
   * Valid values are:
   *   - `false` - do not glob
   *   - `true` - load the base `.env` file first before overwriting it with values for each environment
   *   - `string[]` - load the named `.env` files in order (e.g. `['.env', '.env.common'] before loading the fully
   *   qualified file for the environment.
   *   - `(env: string) => string[]` - get an exhaustive list of files to use based on the environment.
   *
   * Defaults to `false`.
   */
  glob?: boolean | string[] | ((env: string) => string[]);
}

/**
 * Plugin to copy the `client.env` files into the build folder.
 */
export const createClientEnvFilesPlugin = ({
  validEnvironments,
  buildFolderName = 'dist',
  buildPath = buildFolderName,
  envPath = './',
  failOnMissing = false,
  glob = false,
}: ClientEnvPluginOptions) => {
  // make build folder if it doesn't exist
  if (!existsSync(buildPath)) {
    mkdirSync(buildPath);
  }

  return {
    name: 'create-client-env-files',
    generateBundle() {
      validEnvironments.forEach((env) => {
        const envSourceFiles = getEnvSourceFiles();
        const envFileContent = getEnvFileContent(envSourceFiles);
        if (!envFileContent) return;

        const destinationFilename = `${buildPath}/client.env.${env}`;
        writeFileSync(destinationFilename, envFileContent);

        console.log(`Created: ${destinationFilename}`);

        //////////

        function getEnvSourceFiles() {
          // If a glob function has been passed, then we are in full manual mode.
          if (typeof glob === 'function') {
            return glob(env)
              .map((filename) => normalize(join(envPath, filename)))
              .filter(existsSync);
          }

          const sourceFilename = normalize(join(envPath, `.env.${env}`));

          if (!existsSync(sourceFilename)) {
            const warning = `.env file not found: ${sourceFilename}`;
            if (failOnMissing) {
              throw new Error(warning);
            }

            console.warn(warning);
            return [];
          }

          if (!glob) {
            return [sourceFilename];
          }

          const filenamesToGlob = Array.isArray(glob) ? glob : ['.env'];
          return [...filenamesToGlob.map((filename) => normalize(join(envPath, filename))), sourceFilename];
        }

        function getEnvFileContent(sourceFiles: string[]) {
          if (!sourceFiles.length) return null;

          // Use dotenv to load the base .env file and then the environmental overrides
          const envValues = sourceFiles.reduce((acc, filename) => {
            if (existsSync(filename)) {
              const fileContent = readFileSync(filename);
              populate(acc, parse(fileContent), { override: true });
            } else {
              console.log(env, `Missing source file for ${env}: ${filename}`);
            }

            return acc;
          }, {});

          // Now write out the values as a new .env file
          return Object.entries(envValues)
            .map(([key, value]) => `${key}="${value}"`)
            .sort((left, right) => left.localeCompare(right))
            .join('\n');
        }
      });
    },
  };
};
