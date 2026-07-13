const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isDev = process.argv.includes('--dev');
const isWatch = process.argv.includes('--watch');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const addonDir = path.join(rootDir, 'addon');
const buildDir = path.join(rootDir, 'build');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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
    ensureDir(path.dirname(destPath));
    fs.copyFileSync(srcPath, destPath);
  }
}

function createBootstrapWrapper(bundleCode) {
  return `(function() {
    ${bundleCode}
  })();`;
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
  ensureDir(buildDir);
  copyFiles();

  await esbuild.build({
    entryPoints: [path.join(srcDir, 'bootstrap.ts')],
    bundle: true,
    minify: !isDev,
    sourcemap: isDev,
    target: 'ES2020',
    outfile: path.join(buildDir, 'bootstrap.js'),
    platform: 'node',
    external: ['zotero-types'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production')
    }
  });

  const bootstrapPath = path.join(buildDir, 'bootstrap.js');
  let code = fs.readFileSync(bootstrapPath, 'utf-8');
  code = createBootstrapWrapper(code);
  fs.writeFileSync(bootstrapPath, code);

  await createXPI();
}

async function buildWatch() {
  ensureDir(buildDir);
  copyFiles();

  const context = await esbuild.context({
    entryPoints: [path.join(srcDir, 'bootstrap.ts')],
    bundle: true,
    minify: !isDev,
    sourcemap: isDev,
    target: 'ES2020',
    outfile: path.join(buildDir, 'bootstrap.js'),
    platform: 'node',
    external: ['zotero-types'],
    define: {
      'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production')
    }
  });

  await context.watch();

  const bootstrapPath = path.join(buildDir, 'bootstrap.js');
  let code = fs.readFileSync(bootstrapPath, 'utf-8');
  code = createBootstrapWrapper(code);
  fs.writeFileSync(bootstrapPath, code);

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
