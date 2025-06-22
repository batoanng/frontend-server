import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const getIndexHtmlFilename = (filename: string | null | undefined, clientBuildPath: string) => {
  const defaultPath = join(clientBuildPath, `index.html`);
  if (!filename) return defaultPath;

  try {
    if (existsSync(filename)) return filename;

    const filenameInBuildPath = join(clientBuildPath, filename);
    if (existsSync(filenameInBuildPath)) return filenameInBuildPath;
  } catch {
    // ignore - we'll just fall back to the default
  }

  console.warn(`Could not find index.html file at: ${filename}. Reverting to default (${defaultPath}).`);
  return defaultPath;
};

export const loadIndexHtml = (
  configuredFilename: string | null | undefined,
  clientBuildPath: string,
  clientEnvCode: string,
  ...headScripts: (string | undefined | null)[]
) => {
  const indexFileName = getIndexHtmlFilename(configuredFilename, clientBuildPath);

  try {
    let indexHtml = readFileSync(indexFileName, 'utf8');
    indexHtml = removeLegacyEnvInjectionSite(indexHtml);
    indexHtml = insertHeadScripts(indexHtml);

    return indexHtml;
  } catch (err) {
    console.error('Could not read config file using path: ' + indexFileName);
    return '<html lang="en"><body>Unable to load the page you requested</body></html>';
  }

  function removeLegacyEnvInjectionSite(html: string) {
    const updatedHtml = html.replace(/<script.+?window.process = { env: { VITE_ENVIRONMENT:.+?\/script>/i, '');
    if (updatedHtml.length != html.length) {
      console.warn(
        'Legacy client env code injection site located - please remove the entire script containing `window.process = { env: {...} }` from your index.html page.'
      );
    }

    return updatedHtml;
  }

  function insertHeadScripts(html: string) {
    const envScript = `<script id="global-env-settings" type="text/javascript">${clientEnvCode}</script>`;

    // Filter out empty scripts and ensure each script is wrapped in its own tag
    const filteredScripts = headScripts.filter(Boolean);

    // Combine all scripts, starting with env script
    const allScripts = [envScript, ...filteredScripts];

    // Add the scripts before any other scripts in head
    const matches = /<\/head>/i.exec(html);
    if (!matches?.index) {
      console.warn(`Cannot dynamically insert head scripts - could not find closing </head> tag`);
      return html;
    }

    // If we don't find any other scripts in the head - likely something is wrong - but just in case, we'll add
    // these extra scripts just before the closing </head> tag.
    const otherScriptMatches = /<script/i.exec(html);
    const insertionIndex = otherScriptMatches ? Math.min(otherScriptMatches.index, matches.index) : matches.index;

    return [html.slice(0, insertionIndex), allScripts.join('\n'), html.slice(insertionIndex)].join('');
  }
};
