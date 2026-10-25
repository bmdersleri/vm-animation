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
    expect(concepts.length).toBe(32);
  });

  it('only hazir cards are links: the chapter 1 page, the four chapter 2 pages, iqr-aykiri/, olcekleme/, pca/, ozellik-secimi/, karar-agaci/, knn/, naive-bayes/, the three chapter 6 pages and the four chapter 7 pages and the two chapter 8 pages and the two chapter 9 pages and the two chapter 10 pages and the two chapter 11 pages and the two chapter 12 pages and the two chapter 13 pages and the chapter 14 page', () => {
    const root = render();
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a.card')];
    expect(links.length).toBe(32);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      'crisp-dm/', 'dagilim-carpiklik/', 'normal-dagilim/', 'korelasyon-isi-haritasi/', 'kutu-grafigi/',
      'iqr-aykiri/', 'olcekleme/', 'pca/', 'ozellik-secimi/', 'karar-agaci/', 'knn/', 'naive-bayes/',
      'karmasiklik-matrisi/', 'roc-esik/', 'capraz-dogrulama/', 'k-means/', 'k-secimi/', 'dbscan/', 'dendrogram/',
      'birliktelik-olculeri/', 'apriori/', 'bagging/', 'random-forest/',
      'gradyan-artirma/', 'boosting-ayarlari/',
      'dengesiz-veri/', 'smote-sizinti/',
      'tfidf-kosinus/', 'duygu-analizi/',
      'shap-degerleri/', 'lime-yerel/', 'model-kaymasi/',
    ]);
    expect(links[10].textContent).toContain('k-En Yakın Komşu (k-NN)');
    const ders = root.querySelector<HTMLAnchorElement>('a.card-ders[href="knn/?mod=ders"]');
    expect(ders?.getAttribute('href')).toBe('knn/?mod=ders');
    expect(ders?.textContent).toBe('Ders modunda aç');
    const soon = root.querySelectorAll('.card.yakinda');
    // every page is ready: no card is marked soon, and the grid renders no empty "Yakında" group
    expect(soon.length).toBe(0);
    expect(concepts.length - links.length).toBe(0);
    expect(root.textContent).not.toContain('Yakında');
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
    expect(heads.length).toBe(14);
    expect(heads[0]).toBe('Bölüm 1 · Modern Veri Madenciliğine Giriş ve CRISP-DM Metodolojisi');
    expect(heads[1]).toBe('Bölüm 2 · Keşifçi Veri Analizi (EDA) ve İstatistiksel Görselleştirme');
    expect(heads[4]).toBe('Bölüm 5 · Sınıflandırmaya Giriş: Karar Ağaçları, k-NN ve Naive Bayes');
    const nums = heads.map((h) => Number(/Bölüm (\d+)/.exec(h!)![1]));
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    const sec2 = [...root.querySelectorAll('section')][1];
    expect([...sec2.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Dağılım, ortalama–medyan ve çarpıklık',
      'Normal dağılım ve standart sapma',
      'Korelasyon, ısı haritası ve Anscombe Dörtlüsü',
      'Kutu grafiği: çeyrekler ve aykırı değerler',
    ]);
    const sec5 = [...root.querySelectorAll('section')][4];
    expect([...sec5.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Karar ağacı (Gini/Entropi)',
      'k-En Yakın Komşu (k-NN)',
      'Naive Bayes',
    ]);
    expect(sec5.querySelectorAll('svg[aria-hidden="true"]').length).toBe(3);
    const sec6 = [...root.querySelectorAll('section')][5];
    expect([...sec6.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'Karmaşıklık matrisi ve metrikler',
      'ROC, PR ve karar eşiği',
      'Çapraz doğrulama ve veri sızıntısı',
    ]);
    expect([...sec6.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['karmasiklik-matrisi/', 'roc-esik/', 'capraz-dogrulama/']);
    const sec7 = [...root.querySelectorAll('section')][6];
    expect([...sec7.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['k-means/', 'k-secimi/', 'dbscan/', 'dendrogram/']);
    const sec8 = [...root.querySelectorAll('section')][7];
    expect([...sec8.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['birliktelik-olculeri/', 'apriori/']);
    const sec9 = [...root.querySelectorAll('section')][8];
    expect([...sec9.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['bagging/', 'random-forest/']);
    expect([...sec9.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Bootstrap ve bagging', 'Random Forest, OOB ve öznitelik önemi']);
    const sec11 = [...root.querySelectorAll('section')][10];
    expect([...sec11.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['dengesiz-veri/', 'smote-sizinti/']);
    const sec12 = [...root.querySelectorAll('section')][11];
    expect([...sec12.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['tfidf-kosinus/', 'duygu-analizi/']);
    const sec13 = [...root.querySelectorAll('section')][12];
    expect([...sec13.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['shap-degerleri/', 'lime-yerel/']);
    const sec1 = [...root.querySelectorAll('section')][0];
    expect([...sec1.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['crisp-dm/']);
    const sec14 = [...root.querySelectorAll('section')][13];
    expect([...sec14.querySelectorAll('a.card')].map((a) => a.getAttribute('href'))).toEqual(['model-kaymasi/']);
    const sec4 = [...root.querySelectorAll('section')][3];
    expect([...sec4.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      'PCA ve t-SNE ile boyut indirgeme',
      'Özellik seçimi: filtre ve sarmalayıcı',
    ]);
    const sec3 = [...root.querySelectorAll('section')][2];
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
