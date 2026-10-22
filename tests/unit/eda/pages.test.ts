// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { dagilimCarpiklikPage } from '../../../src/concepts/dagilim-carpiklik/main';
import { kutuGrafigiPage } from '../../../src/concepts/kutu-grafigi/main';
import { korelasyonIsiHaritasiPage } from '../../../src/concepts/korelasyon-isi-haritasi/main';

const PAGES = [
  ['dagilim-carpiklik', dagilimCarpiklikPage],
  ['kutu-grafigi', kutuGrafigiPage],
  ['korelasyon-isi-haritasi', korelasyonIsiHaritasiPage],
] as const;

describe('chapter 2 page shells', () => {
  it('the header names chapter 2 as the registry does', () => {
    for (const [, page] of PAGES) expect(page.chapter).toBe('Bölüm 2 · Keşifçi Veri Analizi (EDA)');
  });

  it('each index.html has a descriptive meta description, not the scaffold placeholder', () => {
    for (const [slug] of PAGES) {
      const html = fs.readFileSync(`${slug}/index.html`, 'utf8');
      const m = /<meta name="description" content="([^"]+)"/.exec(html);
      expect(m, slug).not.toBeNull();
      const content = m?.[1] ?? '';
      expect(content, slug).not.toMatch(/— etkileşimli animasyon\.$/);
      expect(content.length, slug).toBeGreaterThan(90);
      expect(content, slug).toMatch(/etkileşimli animasyon\.$/);
    }
  });
});
