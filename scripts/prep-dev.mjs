import fs from 'node:fs';

if (fs.existsSync('index.source.html')) {
  fs.copyFileSync('index.source.html', 'index.html');
  console.log('Restored index.source.html -> index.html for Vite dev');
}
