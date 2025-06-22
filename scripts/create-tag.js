// scripts/create-tag.js
const fs = require('fs');
const semver = require('semver');
const { execSync } = require('child_process');

const bumpType = process.argv[2] || 'patch';

const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

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
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// Commit and tag
execSync('git add package.json');
execSync(`git commit -m "chore(release): bump version to ${newVersion}"`);
execSync(`git tag ${tagName}`);
execSync('git push');
execSync(`git push origin ${tagName}`);

console.log(`✅ Published ${tagName} and committed version bump.`);
