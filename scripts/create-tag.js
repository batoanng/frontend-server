import { exec } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import semver from 'semver';
import { promisify } from 'util';

const execAsync = promisify(exec);

const bumpType = process.argv[2] || 'patch';
const pkgPath = './package.json';

const pkgRaw = await readFile(pkgPath, 'utf8');
const pkg = JSON.parse(pkgRaw);

const currentVersion = pkg.version;
const newVersion = semver.inc(currentVersion, bumpType);

if (!newVersion) {
  console.error(`❌ Invalid bump type: "${bumpType}"`);
  process.exit(1);
}

const tagName = `v${newVersion}`;
console.log(`📦 Bumping version: ${currentVersion} → ${newVersion}`);
console.log(`🔖 Creating git tag: ${tagName}`);

// Update package.json
pkg.version = newVersion;
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Commit and tag
await execAsync('git add package.json');
await execAsync(`git commit -m "chore(release): bump version to ${newVersion}"`);
await execAsync(`git tag ${tagName}`);
await execAsync('git push');
await execAsync(`git push origin ${tagName}`);

console.log(`✅ Tag ${tagName} created and pushed.`);
