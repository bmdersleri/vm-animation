// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { concepts } from '../../src/concepts/registry';
import { renderHome } from '../../src/home/main';

function render(): HTMLElement {
  const root = document.createElement('div');
  renderHome(root);
  return root;
}

describe('home page', () => {
  it('one card per concept', () => {
    const root = render();
    expect(root.querySelectorAll('.card').length).toBe(concepts.length);
    expect(concepts.length).toBe(20);
  });

  it('only hazir cards are links and k-NN links to knn/', () => {
    const root = render();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a.card')];
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('knn/');
    expect(links[0].textContent).toContain('k-En Yakın Komşu (k-NN)');
    const ders = root.querySelector<HTMLAnchorElement>('a.card-ders');
    expect(ders?.getAttribute('href')).toBe('knn/?mod=ders');
    expect(ders?.textContent).toBe('Ders modunda aç');
    const soon = root.querySelectorAll('.card.yakinda');
    expect(soon.length).toBe(concepts.length - 1);
    soon.forEach((c) => {
      expect(c.tagName).not.toBe('A');
      expect(c.textContent).toContain('Yakında');
      expect(c.querySelector('a')).toBeNull();
    });
  });

  it('cards grouped under chapter headings in order', () => {
    const root = render();
    expect(root.querySelector('h1')?.textContent).toBe('Modern Veri Madenciliğine Giriş');
    const heads = [...root.querySelectorAll('h2')].map((h) => h.textContent);
    expect(heads.length).toBe(12);
    expect(heads[0]).toBe('Bölüm 2 · Keşifçi Veri Analizi (EDA) ve İstatistiksel Görselleştirme');
    expect(heads[3]).toBe('Bölüm 5 · Sınıflandırmaya Giriş: Karar Ağaçları, k-NN ve Naive Bayes');
    const nums = heads.map((h) => Number(/Bölüm (\d+)/.exec(h!)![1]));
    expect(nums).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    const sec5 = [...root.querySelectorAll('section')][3];
    expect([...sec5.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Karar ağacı (Gini/Entropi)',
      'k-En Yakın Komşu (k-NN)',
      'Naive Bayes',
    ]);
    expect(sec5.querySelectorAll('svg[aria-hidden="true"]').length).toBe(3);
  });
});
