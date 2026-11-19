import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceHtml = path.join(root, 'index.source.html');
const entryHtml = path.join(root, 'index.html');
const distDir = path.join(root, 'dist');

// 1. Ensure source template is in place
if (fs.existsSync(sourceHtml)) {
  fs.copyFileSync(sourceHtml, entryHtml);
} else {
  fs.copyFileSync(entryHtml, sourceHtml);
}

// 2. Run Vite build
execSync('npx vite build', {stdio: 'inherit'});

// 3. Run single-file builder
execSync('node scripts/build-singlefile.mjs', {stdio: 'inherit'});

// 4. Copy built dist/ files to root for GitHub Pages direct serving
const filesToRoot = [
  'index.html',
  'sw.js',
  'registerSW.js',
  'manifest.webmanifest',
  'icon.svg',
  'apple-touch-icon.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-512x512.png',
];

for (const f of filesToRoot) {
  const src = path.join(distDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(root, f));
  }
}

// Copy workbox chunk
const distFiles = fs.readdirSync(distDir);
for (const f of distFiles.filter((name) => name.startsWith('workbox-') && name.endsWith('.js'))) {
  fs.copyFileSync(path.join(distDir, f), path.join(root, f));
}

// Copy assets directory
const distAssets = path.join(distDir, 'assets');
const rootAssets = path.join(root, 'assets');
if (fs.existsSync(distAssets)) {
  fs.cpSync(distAssets, rootAssets, {recursive: true, force: true});
}

console.log('✓ Successfully synced production build to root for GitHub Pages deployment.');
