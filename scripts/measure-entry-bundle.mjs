import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

// Requiere vite build --manifest. Cuenta únicamente imports estáticos del entry,
// no los chunks diferidos de otras rutas. No es una medición de LCP o red real.
const root = path.resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '.vite/manifest.json'), 'utf8'));
const entry = Object.keys(manifest).find(key => manifest[key].isEntry);
const seen = new Set();
function visit(key) {
  if (seen.has(key)) return;
  seen.add(key);
  for (const dependency of manifest[key].imports || []) visit(dependency);
}
visit(entry);
const files = [...seen].map(key => manifest[key].file).filter(file => file.endsWith('.js'));
const sizes = files.map(file => {
  const bytes = fs.readFileSync(path.join(root, file));
  return { file, bytes: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
});
process.stdout.write(JSON.stringify({ entry, files: sizes, js_bytes: sizes.reduce((n, s) => n + s.bytes, 0), js_gzip: sizes.reduce((n, s) => n + s.gzip, 0) }, null, 2) + '\n');
