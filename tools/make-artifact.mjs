// Builds a single self-contained page fragment from the normal `dist/` build:
// the JS and CSS bundles are inlined, and the document skeleton is removed so the
// fragment can be hosted inside another page shell.
// (Replacement callbacks are used so `$` sequences inside the bundle stay intact.)
import fs from 'node:fs';
import path from 'node:path';
const dist = 'dist';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const read = (href) => fs.readFileSync(path.join(dist, href.replace(/^\.\//, '')), 'utf8');
let js = '';
let css = '';
html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => ((js += read(src)), ''));
html.replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => ((css += read(href)), ''));
const fonts = (html.match(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/) || [''])[0];
const safeJs = js.replace(/<\/script/gi, () => '<\\/script');
const out = [
  '<title>The Architect</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  fonts,
  '<style>',
  css,
  '</style>',
  '<div id="root"></div>',
  '<script type="module">',
  safeJs,
  '</script>',
].join('\n');
fs.mkdirSync('dist-artifact', { recursive: true });
fs.writeFileSync('dist-artifact/the-architect.html', out);
console.log('wrote dist-artifact/the-architect.html', (out.length / 1024).toFixed(0) + 'KB');
