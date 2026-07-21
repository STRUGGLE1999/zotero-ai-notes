const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageVersion = require(path.join(rootDir, 'package.json')).version;
const buildScript = path.join(rootDir, 'scripts', 'build.js');
const xpiPath = path.join(rootDir, `zotero-ai-notes-${packageVersion}.xpi`);

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function buildAndHash() {
  execFileSync(process.execPath, [buildScript], { cwd: rootDir, stdio: 'inherit' });
  return sha256(xpiPath);
}

const firstHash = buildAndHash();
const secondHash = buildAndHash();

if (firstHash !== secondHash) {
  console.error('Reproducible build verification FAILED');
  console.error(`First build:  ${firstHash}`);
  console.error(`Second build: ${secondHash}`);
  process.exit(1);
}

console.log(`Reproducible build verification PASSED: ${firstHash}`);
