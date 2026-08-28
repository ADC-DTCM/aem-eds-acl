import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokenDir = join(root, 'styles', 'tokens');
const dest = join(root, 'styles', 'tokens.css');

const PARTIALS = [
  'colours.css',
  'spacing.css',
  'borders.css',
  'font.css',
  'sizes.css',
];

function innerRoot(css) {
  const match = css.match(/:root\s*\{([\s\S]*)\}/);
  if (!match) {
    throw new Error('Expected a :root block');
  }
  return match[1].trim();
}

function build() {
  const header = [
    '/*',
    ' * Generated from styles/tokens/*.css — do not edit.',
    ' * After changing a partial, run: npm run build:tokens',
    ' */',
    '',
  ].join('\n');

  const sections = PARTIALS.map((name) => {
    const css = readFileSync(join(tokenDir, name), 'utf8').replace(/\r\n/g, '\n');
    return `  ${innerRoot(css)}`;
  });

  return `${header}:root {\n${sections.join('\n')}\n}\n`;
}

const output = build();
const check = process.argv.includes('--check');

if (check) {
  const existing = readFileSync(dest, 'utf8').replace(/\r\n/g, '\n');
  if (existing !== output) {
    process.stderr.write('styles/tokens.css is stale. Run npm run build:tokens\n');
    process.exit(1);
  }
} else {
  writeFileSync(dest, output);
}
