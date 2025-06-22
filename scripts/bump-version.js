const fs = require('fs');
const semver = require('semver');

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// Get current version
const currentVersion = pkg.version;

// Choose which bump type — you can use environment variable or logic to decide
const bumpType = process.env.BUMP_TYPE || 'patch'; // could be 'major', 'minor', or 'patch'

// Calculate next version
const nextVersion = semver.inc(currentVersion, bumpType);

if (!nextVersion) {
  console.error('Invalid version bump');
  process.exit(1);
}

pkg.version = nextVersion;
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));

console.log(`Bumped version: ${currentVersion} → ${nextVersion}`);
