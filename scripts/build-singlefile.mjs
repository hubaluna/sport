import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const assetsDir = path.join(distDir, 'assets');
const htmlPath = path.join(distDir, 'index.html');
const outPath = path.join(root, 'FORGE-8-single.html');

if (!fs.existsSync(htmlPath) || !fs.existsSync(assetsDir)) {
  throw new Error('dist/ not found. Run "npm run build" first.');
}

let html = fs.readFileSync(htmlPath, 'utf8');
const assetFiles = fs.readdirSync(assetsDir);

// Inline CSS into <head>
for (const file of assetFiles.filter((f) => f.endsWith('.css'))) {
  const css = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  const escapedCss = css.replace(/<\/style>/gi, '<\\/style>');
  const linkRe = new RegExp(
    `<link[^>]+href=["'](?:\\./|/)?assets/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i',
  );
  html = html.replace(linkRe, () => `<style>\n${escapedCss}\n</style>`);
}

// Inline JS at end of <body> so DOM is fully ready
let inlineScripts = '';
for (const file of assetFiles.filter((f) => f.endsWith('.js'))) {
  const js = fs.readFileSync(path.join(assetsDir, file), 'utf8');
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const scriptRe = new RegExp(
    `<script[^>]+src=["'](?:\\./|/)?assets/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>\\s*</script>`,
    'i',
  );
  html = html.replace(scriptRe, '');
  inlineScripts += `<script type="module">\n${safeJs}\n</script>\n`;
}

if (inlineScripts) {
  if (html.includes('</body>')) {
    html = html.replace('</body>', `${inlineScripts}</body>`);
  } else {
    html += inlineScripts;
  }
}

// Inline SVG favicon & Apple touch icon if present
const svgPath = path.join(distDir, 'icon.svg');
if (fs.existsSync(svgPath)) {
  const svgB64 = fs.readFileSync(svgPath).toString('base64');
  html = html.replace(
    /href=["'](?:\.\/|\/)?icon\.svg["']/gi,
    `href="data:image/svg+xml;base64,${svgB64}"`,
  );
}
const applePath = path.join(distDir, 'apple-touch-icon.png');
if (fs.existsSync(applePath)) {
  const pngB64 = fs.readFileSync(applePath).toString('base64');
  html = html.replace(
    /href=["'](?:\.\/|\/)?apple-touch-icon\.png["']/gi,
    `href="data:image/png;base64,${pngB64}"`,
  );
}

// Strip external SW / manifest links so file:// standalone runs cleanly without 404s
html = html.replace(/<link[^>]+rel=["']manifest["'][^>]*>\s*/gi, '');
html = html.replace(
  /<script[^>]+(?:src=["'](?:\.\/|\/)?registerSW\.js["']|id=["']vite-plugin-pwa:register-sw["'])[^>]*>[\s\S]*?<\/script>\s*/gi,
  '',
);

fs.writeFileSync(outPath, html, 'utf8');
const kb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`Built single-file HTML: ${path.basename(outPath)} (${kb} KB)`);
