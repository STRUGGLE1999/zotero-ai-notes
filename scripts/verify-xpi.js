const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const rootDir = path.resolve(__dirname, '..');

function getFilesizeInBytes(filename) {
  const stats = fs.statSync(filename);
  return stats.size;
}

function getFileHash(filename, algorithm = 'sha256') {
  const data = fs.readFileSync(filename);
  return createHash(algorithm).update(data).digest('hex');
}

function getFileModifiedTime(filename) {
  const stats = fs.statSync(filename);
  return stats.mtime.toISOString();
}

function listDirectoryTree(dir, prefix = '') {
  const files = fs.readdirSync(dir);
  files.sort();
  
  const tree = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(dir, file);
    const isLast = i === files.length - 1;
    const isDirectory = fs.statSync(filePath).isDirectory();
    
    tree.push(`${prefix}${isLast ? '└──' : '├──'} ${file}${isDirectory ? '/' : ''}`);
    
    if (isDirectory) {
      tree.push(...listDirectoryTree(filePath, prefix + (isLast ? '    ' : '│   ')));
    }
  }
  
  return tree;
}

async function verifyXPI() {
  const xpiPath = path.join(rootDir, 'zotero-ai-notes-0.1.0.xpi');
  
  if (!fs.existsSync(xpiPath)) {
    console.error('Error: XPI file not found:', xpiPath);
    process.exit(1);
  }
  
  console.log('========================================');
  console.log('Zotero AI Notes XPI Verification Report');
  console.log('========================================\n');
  
  console.log('1. File Information');
  console.log('-------------------');
  console.log(`   File Path: ${xpiPath}`);
  console.log(`   Modified:  ${getFileModifiedTime(xpiPath)}`);
  console.log(`   Size:      ${getFilesizeInBytes(xpiPath)} bytes (${(getFilesizeInBytes(xpiPath) / 1024).toFixed(2)} KB)`);
  console.log(`   SHA-256:   ${getFileHash(xpiPath, 'sha256')}\n`);
  
  const JSZip = require('jszip');
  const xpiData = fs.readFileSync(xpiPath);
  const zip = await JSZip.loadAsync(xpiData);
  
  console.log('2. XPI Content Verification');
  console.log('---------------------------');
  
  const filesInZip = [];
  zip.forEach((relativePath, zipEntry) => {
    filesInZip.push({
      path: relativePath,
      size: zipEntry.uncompressedSize,
      isDirectory: zipEntry.dir
    });
  });
  
  const rootFiles = filesInZip.filter(f => !f.path.includes('/'));
  const hasManifest = rootFiles.some(f => f.path === 'manifest.json');
  const hasBootstrap = rootFiles.some(f => f.path === 'bootstrap.js');
  
  console.log(`   manifest.json in root: ${hasManifest ? '✓' : '✗'}`);
  console.log(`   bootstrap.js in root:  ${hasBootstrap ? '✓' : '✗'}`);
  
  if (!hasManifest) {
    console.error('   Error: manifest.json not found in XPI root');
  }
  if (!hasBootstrap) {
    console.error('   Error: bootstrap.js not found in XPI root');
  }
  
  console.log('\n3. XPI Directory Tree');
  console.log('---------------------');
  
  const tempExtractDir = path.join(rootDir, 'temp-xpi-extract');
  if (fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true });
  }
  fs.mkdirSync(tempExtractDir, { recursive: true });
  
  for (const fileInfo of filesInZip) {
    if (!fileInfo.isDirectory) {
      const filePath = path.join(tempExtractDir, fileInfo.path);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const content = await zip.file(fileInfo.path).async('nodebuffer');
      fs.writeFileSync(filePath, content);
    }
  }
  
  const tree = listDirectoryTree(tempExtractDir);
  console.log(tree.join('\n'));
  
  const manifestPath = path.join(tempExtractDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log('\n4. manifest.json Content');
    console.log('------------------------');
    console.log(JSON.stringify(manifest, null, 2));
    
    console.log('\n5. Compatibility Check');
    console.log('----------------------');
    const minVersion = manifest.applications?.zotero?.strict_min_version;
    const maxVersion = manifest.applications?.zotero?.strict_max_version;
    const targetVersion = '9.0.6';
    
    console.log(`   Target Zotero Version: ${targetVersion}`);
    console.log(`   strict_min_version:    ${minVersion}`);
    console.log(`   strict_max_version:    ${maxVersion}`);
    
    const matchesMin = compareVersions(targetVersion, minVersion) >= 0;
    const matchesMax = maxVersion.includes('*') 
      ? compareVersions(targetVersion, maxVersion.replace('.*', '.0')) >= 0 && 
        targetVersion.startsWith(maxVersion.replace('.*', ''))
      : compareVersions(targetVersion, maxVersion) <= 0;
    
    console.log(`   Version ${targetVersion} matches min (${minVersion}): ${matchesMin ? '✓' : '✗'}`);
    console.log(`   Version ${targetVersion} matches max (${maxVersion}): ${matchesMax ? '✓' : '✗'}`);
    
    if (matchesMin && matchesMax) {
      console.log('\n✅ XPI verification PASSED - Compatible with Zotero 9.0.6');
    } else {
      console.error('\n❌ XPI verification FAILED - Version compatibility issue');
      process.exit(1);
    }
  }
  
  fs.rmSync(tempExtractDir, { recursive: true });
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const length = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < length; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) {
      return p1 - p2;
    }
  }
  return 0;
}

verifyXPI().catch(error => {
  console.error('XPI verification failed:', error);
  process.exit(1);
});
