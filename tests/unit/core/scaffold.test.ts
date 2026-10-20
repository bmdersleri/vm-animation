import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffold } from '../../../scripts/yeni-kavram.mjs';

const roots: string[] = [];

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'knn'));
  fs.copyFileSync('knn/index.html', path.join(root, 'knn', 'index.html'));
  fs.copyFileSync('vite.config.ts', path.join(root, 'vite.config.ts'));
  return root;
}

afterEach(() => {
  for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

describe('scaffold', () => {
  it('creates the page files and the vite entry', () => {
    const root = tempRoot();
    const made = scaffold(root, 'ornek-kavram', 'Örnek Kavram');
    for (const rel of [
      'ornek-kavram/index.html',
      'src/concepts/ornek-kavram/main.ts',
      'src/concepts/ornek-kavram/scenario.ts',
      'src/concepts/ornek-kavram/ornek-kavram.css',
      'tests/unit/ornek-kavram/scenario.test.ts',
      'tests/e2e/ornek-kavram.spec.ts',
    ]) {
      expect(made).toContain(rel);
      expect(fs.existsSync(path.join(root, rel)), rel).toBe(true);
    }
    const html = fs.readFileSync(path.join(root, 'ornek-kavram/index.html'), 'utf8');
    expect(html).toContain('<title>Örnek Kavram · Veri Madenciliği Animasyonları</title>');
    expect(html).toContain('/src/concepts/ornek-kavram/main.ts');
    const main = fs.readFileSync(path.join(root, 'src/concepts/ornek-kavram/main.ts'), 'utf8');
    expect(main).toContain("import './ornek-kavram.css';");
    expect(main).toContain('mountConceptPage');
    const vite = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    expect(vite).toContain("'ornek-kavram': resolve(root, 'ornek-kavram/index.html'),");
    expect(vite.indexOf("'ornek-kavram'")).toBeGreaterThan(vite.indexOf('knn: resolve'));
  });

  it('rejects a bad id', () => {
    const root = tempRoot();
    for (const id of ['', 'Büyük', 'a_b', '-a', 'a-', 'a--b', '../x']) {
      expect(() => scaffold(root, id, 'X'), id).toThrow('geçersiz kimlik');
    }
  });

  it('refuses an existing concept', () => {
    const root = tempRoot();
    scaffold(root, 'ornek', 'Örnek');
    expect(() => scaffold(root, 'ornek', 'Örnek')).toThrow('zaten var');
  });
});
