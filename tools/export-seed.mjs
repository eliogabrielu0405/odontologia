#!/usr/bin/env node
// Exporta los datos de ejemplo como documentos JSON para cargarlos en la base del artefacto
// (herramienta ArtifactData, acción "batch" con file_path). Las contraseñas se guardan cifradas.
// Uso: node tools/export-seed.mjs [carpeta-de-salida]   (por defecto dist/seed)
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const buildSeed = require(resolve(root, 'js/seed.js'));
const out = resolve(process.argv[2] || resolve(root, 'dist/seed'));

const hashPassword = (password, salt) => createHash('sha256').update(`${salt}:${password}`, 'utf8').digest('hex');
const seed = buildSeed(new Date());
const docs = [];
const add = (collection, id, data) => docs.push({ collection, id, data });

seed.users.forEach(({ password, ...user }) => {
  const salt = randomBytes(8).toString('hex');
  add('users', user.id, { ...user, salt, passwordHash: hashPassword(password, salt) });
});
['patients', 'treatments', 'appointments', 'budgets', 'payments', 'history', 'consents'].forEach((col) => {
  seed[col].forEach((item) => add(col, item.id, item));
});
Object.entries(seed.odontograms).forEach(([patientId, teeth]) => add('odontograms', patientId, { patientId, teeth }));
add('config', 'clinic', seed.settings);

rmSync(out, { recursive: true, force: true });
docs.forEach(({ collection, id, data }) => {
  const file = resolve(out, collection, `${id}.json`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
});

const batches = [];
for (let i = 0; i < docs.length; i += 50) {
  batches.push(docs.slice(i, i + 50).map(({ collection, id }) => ({ op: 'set', collection, doc_id: id, file_path: resolve(out, collection, `${id}.json`) })));
}
writeFileSync(resolve(out, 'batches.json'), JSON.stringify(batches));
console.log(`${docs.length} documentos en ${batches.length} lotes → ${out}`);
