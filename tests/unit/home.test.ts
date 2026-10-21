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
    expect(concepts.length).toBe(21);
  });

  it('only hazir cards are links: iqr-aykiri/, olcekleme/, pca/, karar-agaci/, knn/ and naive-bayes/', () => {
    const root = render();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a.card')];
    expect(links.length).toBe(6);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['iqr-aykiri/', 'olcekleme/', 'pca/', 'karar-agaci/', 'knn/', 'naive-bayes/']);
    expect(links[4].textContent).toContain('k-En Yakın Komşu (k-NN)');
    const ders = root.querySelector<HTMLAnchorElement>('a.card-ders[href="knn/?mod=ders"]');
    expect(ders?.getAttribute('href')).toBe('knn/?mod=ders');
    expect(ders?.textContent).toBe('Ders modunda aç');
    const soon = root.querySelectorAll('.card.yakinda');
    expect(soon.length).toBe(15);
    expect(concepts.length - links.length).toBe(15);
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
    const sec4 = [...root.querySelectorAll('section')][2];
    expect([...sec4.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'PCA ve t-SNE ile boyut indirgeme',
      'Özellik seçimi: filtre ve sarmalayıcı',
    ]);
    const sec3 = [...root.querySelectorAll('section')][1];
    expect([...sec3.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Eksik veri ve IQR ile aykırı değer',
      'Ölçekleme ve veri sızıntısı',
    ]);
  });

  it('renders subtitle, author and intro sentence', () => {
    const root = render();
    expect(root.querySelector('.subtitle')?.textContent).toBe('Kavram Animasyonları');
    expect(root.querySelector('.author')?.textContent).toBe('Prof. Dr. İsmail KIRBAŞ');
    expect(root.querySelector('.intro')?.textContent).toBe(
      'Kitaptaki temel kavramları adım adım ilerleyen, parametreleriyle oynanabilen animasyonlarla keşfedin. Derste anlatım için Ders modunu, kendi başınıza çalışmak için Laboratuvar modunu kullanın.',
    );
  });
});
