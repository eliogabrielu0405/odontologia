#!/usr/bin/env node
// Genera la página única que se publica como artefacto en claude.ai.
// Uso: node tools/build-artifact.mjs [ruta-de-salida]   (por defecto dist/dentagest.html)
// El artefacto no incluye js/seed.js: los datos viven en la base compartida del artefacto
// y los de ejemplo se cargan con tools/export-seed.mjs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] || resolve(root, 'dist/dentagest.html'));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const FONTS = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Figtree:wght@400;500;600;700&display=swap';
const scripts = ['js/utils.js', 'js/db.js', 'js/odontogram.js', 'js/views.js', 'js/app.js'];

for (const path of scripts) {
  if (/<\/script/i.test(read(path))) throw new Error(`${path} contiene "</script" y rompería la página`);
}
if (/<\/style/i.test(read('css/styles.css'))) throw new Error('css/styles.css contiene "</style"');

const page = [
  '<title>DentaGest</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  `<link rel="stylesheet" href="${FONTS}">`,
  `<style>\n${read('css/styles.css')}</style>`,
  '<div id="app"></div>',
  '<div id="modal-root"></div>',
  '<div id="toast-root" aria-live="polite"></div>',
  ...scripts.map((path) => `<script>\n${read(path)}</script>`),
].join('\n');

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${page}\n`);
console.log(`Artefacto generado: ${out} (${(page.length / 1024).toFixed(1)} KB)`);
