// Concept scaffold: npm run yeni-kavram -- <id> "<Başlık>"
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = (id) => camel(id).replace(/^./, (c) => c.toUpperCase());
/** Single-quoted TS string literal. */
const str = (s) => `'${s.replace(/[\\']/g, '\\$&')}'`;

function write(rootDir, created, rel, content) {
  const abs = path.join(rootDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  created.push(rel);
}

/** Adds an entry after the last one in build.rollupOptions.input of vite.config.ts. */
function addViteEntry(rootDir, id) {
  const vitePath = path.join(rootDir, 'vite.config.ts');
  const vite = fs.readFileSync(vitePath, 'utf8');
  const open = vite.indexOf('input: {');
  const close = open < 0 ? -1 : vite.indexOf('}', open);
  if (close < 0) throw new Error('vite.config.ts: input bulunamadı');
  const lineStart = vite.lastIndexOf('\n', close) + 1; // start of the closing-brace line
  const prevStart = vite.lastIndexOf('\n', lineStart - 2) + 1;
  const indent = /^\s*/.exec(vite.slice(prevStart, lineStart))[0];
  const entry = `${indent}'${id}': resolve(root, '${id}/index.html'),\n`;
  fs.writeFileSync(vitePath, vite.slice(0, lineStart) + entry + vite.slice(lineStart));
}

/** Creates the files of a new concept page; returns the created paths (relative to rootDir). */
export function scaffold(rootDir, id, title) {
  if (!ID_RE.test(id)) throw new Error('geçersiz kimlik');
  if (fs.existsSync(path.join(rootDir, 'src', 'concepts', id))) throw new Error('zaten var');

  const name = camel(id);
  const Params = `${pascal(id)}Params`;
  const created = [];

  const knn = fs.readFileSync(path.join(rootDir, 'knn', 'index.html'), 'utf8');
  const html = knn
    .replace(/<title>[^<]*<\/title>/, `<title>${title} · Veri Madenciliği Animasyonları</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${title} — etkileşimli animasyon." />`)
    .replace('/src/concepts/knn/main.ts', `/src/concepts/${id}/main.ts`);
  write(rootDir, created, `${id}/index.html`, html);

  write(rootDir, created, `src/concepts/${id}/${id}.css`, '');

  write(rootDir, created, `src/concepts/${id}/scenario.ts`, `import type { Scenario } from '../../core/player';

export type ${Params} = Record<string, never>;

export const ${name}Scenario: Scenario<${Params}> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: ${str(title)},
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
`);

  write(rootDir, created, `src/concepts/${id}/main.ts`, `import '../../core/theme.css';
import './${id}.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { ${name}Scenario, type ${Params} } from './scenario';

const ${name}Page: ConceptPage<${Params}> = {
  title: ${str(title)},
  chapter: 'Bölüm ? · …',
  scenario: ${name}Scenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, ${name}Page);
`);

  write(rootDir, created, `tests/unit/${id}/scenario.test.ts`, `import { describe, it, expect } from 'vitest';
import { ${name}Scenario } from '../../../src/concepts/${id}/scenario';

describe('${id} scenario', () => {
  it('has at least one step', () => {
    expect(${name}Scenario.steps.length).toBeGreaterThan(0);
  });
});
`);

  write(rootDir, created, `tests/e2e/${id}.spec.ts`, `import { test, expect } from '@playwright/test';

test('${id}: page opens', async ({ page }) => {
  await page.goto('/${id}/');
  await expect(page.locator('h1.title')).toHaveText(${str(title)});
  await expect(page.locator('.step-count')).toHaveText(/Adım 1 \\/ \\d+/);
});
`);

  addViteEntry(rootDir, id);
  created.push('vite.config.ts');

  return created;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [id, title] = process.argv.slice(2);
  if (!id || !title) {
    console.error('Kullanım: npm run yeni-kavram -- <id> "<Başlık>"');
    process.exit(1);
  }
  try {
    for (const p of scaffold(process.cwd(), id, title)) console.log(p);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
