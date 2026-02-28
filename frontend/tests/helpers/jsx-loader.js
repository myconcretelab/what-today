import path from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';

export async function importJsxModule(sourcePath) {
  const source = await readFile(sourcePath, 'utf8');
  const normalizedSource = source.replace(
    /import\s+([A-Za-z0-9_$]+)\s+from\s+['"]@mui\/icons-material\/[^'"]+['"];\n?/g,
    'const $1 = () => null;\n'
  );

  const transformed = await transform(normalizedSource, {
    loader: 'jsx',
    format: 'esm',
    jsx: 'automatic',
    target: 'es2020',
    sourcefile: sourcePath
  });

  const tempDir = await mkdtemp(path.join(process.cwd(), '.tmp-jsx-'));
  const modulePath = path.join(
    tempDir,
    `${path.basename(sourcePath, path.extname(sourcePath))}.mjs`
  );

  await writeFile(modulePath, transformed.code, 'utf8');

  try {
    const url = `${pathToFileURL(modulePath).href}?v=${Date.now()}`;
    return await import(url);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
