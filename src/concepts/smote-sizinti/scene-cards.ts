import type { Mode } from '../../core/mode';
import type { ViewScene } from './scene-base';
import type { LeakView } from './view';

/** The three other leaks of step 10: the example, what to do about it and the sklearn tool where there is one. */
export const CARDS: readonly { kind: 'hedef' | 'zaman' | 'grup'; title: string; example: string; remedy: string; tool: string }[] = [
  {
    kind: 'hedef',
    title: 'Hedef sızıntısı',
    example: 'Müşterinin iptalinden sonra kesilen son fatura bir özellik olarak kullanılır.',
    remedy: 'Her özelliğin tahmin anında bilinip bilinmediğine bakın; sonradan oluşanı çıkarın.',
    tool: '',
  },
  {
    kind: 'zaman',
    title: 'Zaman sızıntısı',
    example: 'Şubat verisiyle ocak ayı tahmin edilir; model geleceği görmüş olur.',
    remedy: 'Bölmeyi zamana göre yapın: eğitim hep doğrulamadan önce gelir.',
    tool: 'TimeSeriesSplit',
  },
  {
    kind: 'grup',
    title: 'Grup sızıntısı',
    example: 'Aynı müşterinin ayları hem eğitimde hem testte yer alır.',
    remedy: 'Aynı müşterinin bütün satırlarını aynı kümeye koyun.',
    tool: 'GroupKFold',
  },
];

/** The book's exam note. */
export const EXAM_NOTE = 'Ölçekleyici, kodlayıcı, seçici ve SMOTE parametrelerini yalnızca eğitim verisinden öğrenmelidir.';

/** The end-of-lesson links: the imbalanced-data page and the Bölüm 6 cross-validation page. */
export const LINKS: readonly { href: string; text: string }[] = [
  { href: '../dengesiz-veri/', text: 'Dengesiz veri: doğruluk tuzağı, SMOTE ve sınıf ağırlığı' },
  { href: '../capraz-dogrulama/', text: 'Çapraz doğrulama (Bölüm 6)' },
];

/** The card area (step 10): three leak cards, the book's exam note and the two links. */
export class CardsScene implements ViewScene {
  private readonly root: HTMLDivElement;

  constructor(host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'cards-scene';
    const cards = doc.createElement('div');
    cards.className = 'leak-cards';
    for (const c of CARDS) {
      const card = doc.createElement('section');
      card.className = 'leak-card';
      card.dataset.kind = c.kind;
      const h = doc.createElement('h3');
      h.className = 'leak-card-title';
      h.textContent = c.title;
      const ex = doc.createElement('p');
      ex.className = 'leak-card-example';
      ex.textContent = c.example;
      const fix = doc.createElement('p');
      fix.className = 'leak-card-remedy';
      fix.textContent = c.remedy;
      card.append(h, ex, fix);
      if (c.tool) {
        const tool = doc.createElement('code');
        tool.className = 'leak-card-tool';
        tool.textContent = c.tool;
        card.append(tool);
      }
      cards.append(card);
    }
    const note = doc.createElement('p');
    note.className = 'exam-note';
    const label = doc.createElement('strong');
    label.textContent = 'Sınav notu: ';
    note.append(label, EXAM_NOTE);
    const links = doc.createElement('nav');
    links.className = 'leak-links';
    for (const l of LINKS) {
      const a = doc.createElement('a');
      a.href = l.href;
      a.textContent = l.text;
      links.append(a);
    }
    this.root.append(cards, note, links);
    host.append(this.root);
  }

  resize(_w: number, _h: number, _mode: Mode): void {}

  interrupt(): void {}

  destroy(): void {
    this.root.remove();
  }

  update(_v: LeakView, _ms: number): void {}
}
