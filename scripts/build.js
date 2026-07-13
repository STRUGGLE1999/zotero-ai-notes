const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isDev = process.argv.includes('--dev');
const isWatch = process.argv.includes('--watch');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const addonDir = path.join(rootDir, 'addon');
const buildDir = path.join(rootDir, 'build');

function cleanBuild() {
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });
}

function cleanOldXPI() {
  const xpiPath = path.join(rootDir, 'zotero-ai-notes-0.1.0.xpi');
  if (fs.existsSync(xpiPath)) {
    fs.unlinkSync(xpiPath);
  }
  const devXpiPath = path.join(rootDir, 'zotero-ai-notes-dev.xpi');
  if (fs.existsSync(devXpiPath)) {
    fs.unlinkSync(devXpiPath);
  }
}

function copyFiles() {
  const filesToCopy = [
    'manifest.json',
    'locale/en-US/zotero-ai-notes.properties',
    'locale/zh-CN/zotero-ai-notes.properties'
  ];

  for (const file of filesToCopy) {
    const srcPath = path.join(addonDir, file);
    const destPath = path.join(buildDir, file);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
  }
}

async function createXPI() {
  const JSZip = require('jszip');
  const zip = new JSZip();

  const buildFiles = fs.readdirSync(buildDir, { recursive: true });
  for (const file of buildFiles) {
    const filePath = path.join(buildDir, file);
    if (fs.statSync(filePath).isFile()) {
      const relativePath = file.replace(/\\/g, '/');
      zip.file(relativePath, fs.readFileSync(filePath));
    }
  }

  const xpiPath = path.join(rootDir, `zotero-ai-notes-${isDev ? 'dev' : '0.1.0'}.xpi`);
  return new Promise((resolve) => {
    zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
      .pipe(fs.createWriteStream(xpiPath))
      .on('finish', () => {
        const size = fs.statSync(xpiPath).size;
        console.log(`XPI created: ${xpiPath} (${(size / 1024).toFixed(2)} KB)`);
        resolve();
      });
  });
}

async function buildOnce() {
  cleanOldXPI();
  cleanBuild();
  copyFiles();

  await esbuild.build({
    entryPoints: [path.join(srcDir, 'bootstrap.ts')],
    bundle: true,
    minify: !isDev,
    sourcemap: isDev,
    target: 'ES2020',
    outfile: path.join(buildDir, 'bootstrap.js'),
    platform: 'neutral',
    format: 'iife',
    globalName: 'ZoteroAINotes',
    external: ['zotero-types'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production')
    },
    footer: {
      js: `
var startup = ZoteroAINotes.startup;
var shutdown = ZoteroAINotes.shutdown;
var install = ZoteroAINotes.install;
var uninstall = ZoteroAINotes.uninstall;
`
    }
  });

  await createXPI();
}

async function buildWatch() {
  cleanOldXPI();
  cleanBuild();
  copyFiles();

  const context = await esbuild.context({
    entryPoints: [path.join(srcDir, 'bootstrap.ts')],
    bundle: true,
    minify: !isDev,
    sourcemap: isDev,
    target: 'ES2020',
    outfile: path.join(buildDir, 'bootstrap.js'),
    platform: 'neutral',
    format: 'iife',
    globalName: 'ZoteroAINotes',
    external: ['zotero-types'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production')
    },
    footer: {
      js: `
var startup = ZoteroAINotes.startup;
var shutdown = ZoteroAINotes.shutdown;
var install = ZoteroAINotes.install;
var uninstall = ZoteroAINotes.uninstall;
`
    }
  });

  await context.watch();
  await createXPI();

  console.log('Watching for changes...');
}

async function build() {
  if (isWatch) {
    await buildWatch();
  } else {
    await buildOnce();
  }
}

build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
