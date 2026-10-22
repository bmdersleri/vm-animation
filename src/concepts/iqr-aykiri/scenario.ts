import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { Action, Fill } from './outlier';

export interface IqrParams {
  /** Replaces the book's extreme invoice (200 in part 1, 480 in part 2); 50..500. */
  extreme: number;
  fill: Fill;
  k: 1.5 | 3;
  action: Action;
}

/** Steps 1-5 (index 0-4) are part 1; part 2 is index 5-10. */
export const PART1_LAST = 4;

const P1 = { extreme: 200, k: 1.5, action: 'yok' } as const;
const P2 = { extreme: 480, fill: 'yok', k: 1.5, action: 'yok' } as const;

export const iqrAykiriScenario: Scenario<IqrParams> = {
  defaults: { extreme: 200, fill: 'yok', k: 1.5, action: 'yok' },
  steps: [
    {
      id: 'bos-hucre',
      title: 'Boş hücreler',
      text: 'Sekiz fatura kartından ikisi boş: bu eksik veri (missing data) oranı %25. Sayı doğrusunda yalnızca altı nokta var; 200,00 kırık eksenin ötesinde duruyor.',
      labText: `Uç değer kaydırıcısını oynat ve doldurma seçeneğini değiştir. Noktaların konumu ve doldurulan değerler sahnede canlı okunur.`,
      term: 'eksik veri (missing data)',
      params: { ...P1, fill: 'yok' },
    },
    {
      id: 'ortalama',
      title: 'Ortalama',
      text: 'Denge üçgeni eksen boyunca kayar ve 68,77’de durur. Ortalama (mean) kalabalığın sağında kalır, çünkü 200 onu kendine çeker.',
      labText: `Uç değer kaydırıcısını oynat. Ortalamanın uç değerle nasıl kaydığı sahnede canlı okunur.`,
      term: 'ortalama (mean)',
      params: { ...P1, fill: 'yok' },
    },
    {
      id: 'medyan',
      title: 'Medyan',
      text: 'Kartlar sıralanır; ortadaki iki değer (42,30 ve 45,00) vurgulanır. Medyan (median) 43,65’te belirir ve uç değerden etkilenmez.',
      labText: `Uç değeri ve doldurmayı değiştir. Medyan sahnede canlı okunur; uç değer oynarken yerinde kalıp kalmadığına bak.`,
      term: 'medyan (median)',
      params: { ...P1, fill: 'yok' },
    },
    {
      id: 'ortalamayla',
      title: 'Ortalamayla doldurma',
      text: 'İki boş kart 68,77 alır. Bu doldurma (imputation) iki yeni noktayı kalabalığın dışına, sağa düşürür.',
      labText: `Uç değeri değiştir. Boş kartlara verilen ortalama değer, uç değerle birlikte sahnede canlı değişir.`,
      term: 'doldurma (imputation)',
      params: { ...P1, fill: 'ortalama' },
    },
    {
      id: 'medyanla',
      title: 'Medyanla doldurma',
      text: 'Doldurulan noktalar 43,65’e, kalabalığın içine kayar. Medyan uç değere karşı dayanıklıdır (robust).',
      labText: `Uç değeri değiştir. Boş kartlara verilen medyan değer sahnede canlı okunur; uç değerden etkilenip etkilenmediğine bak.`,
      term: 'dayanıklı (robust)',
      params: { ...P1, fill: 'medyan' },
    },
    {
      id: 'sirala',
      title: 'Sırala',
      text: 'Sahne kitabın 003 verisine geçer: sekiz fatura, 480,00 kırık eksenin ötesinde. Kartlar sıralanır ve altlarında 0–7 sıra numaraları belirir; çeyrek (quartile) bu sıradan bulunur.',
      labText: `Uç değer kaydırıcısıyla kartların sırasını değiştir. Sıra numaraları sahnede canlı okunur.`,
      term: 'çeyrek (quartile)',
      params: { ...P2 },
    },
    {
      id: 'q1',
      title: 'Q1',
      text: 'Q1, 1,75. konumda: 1. ve 2. kartın arasında, 2.’ye daha yakın. Değer doğrusal ara değer (linear interpolation) ile 41,35 bulunur.',
      labText: `Uç değeri değiştir. Q1 sahnede canlı okunur; uç değer diğer kartların sırasını bozmadıkça Q1 yerinde kalır.`,
      term: 'doğrusal ara değer (linear interpolation)',
      params: { ...P2 },
    },
    {
      id: 'q3-kutu',
      title: 'Q3 ve kutu',
      text: 'Q3, 5,25. konumda ve 57,76’dır. Kutu Q1’den Q3’e çizilir; genişliği çeyrekler arası açıklık (IQR) = 57,76 − 41,35 = 16,41.',
      labText: `Uç değeri değiştir. Q3, kutu ve IQR değeri sahnede canlı okunur.`,
      term: 'çeyrekler arası açıklık (IQR)',
      params: { ...P2 },
    },
    {
      id: 'tukey',
      title: 'Tukey sınırları',
      text: 'Kutunun iki yanına 1,5 × 16,41 = 24,62 uzunluğunda kollar açılır; sınırlar 16,73 ve 82,38’de kesik çizgi olur. 480 dışarıda kaldığı için aykırı işaretlenir.',
      labText: `Uç değeri ve IQR katsayısını değiştir. Sınırlar ve aykırı işaretlenen noktalar sahnede canlı okunur.`,
      term: 'Tukey’in 1,5 × IQR kuralı',
      params: { ...P2 },
    },
    {
      id: 'z-score',
      title: 'Neden Z-score değil?',
      text: 'Z-score ile 480’in puanı (480 − 100,49) / 143,74 = 2,64 çıkar, yani 3’ün altında kalır. 480 ortalamayı ve sapmayı kendisi şişirdiği için yakalanmaz; çeyrekler ise ondan etkilenmez.',
      labText: `Uç değeri oynat ve Z-score ile çeyrek kuralını karşılaştır. İki yöntemin uç değeri yakalayıp yakalamadığı sahnede canlı okunur.`,
      term: 'Z-score',
      params: { ...P2 },
    },
    {
      id: 'sil-kirp',
      title: 'Sil mi, kırp mı?',
      text: '480 kırık eksenden çıkıp üst sınır olan 82,38’de durur; bu kırpma (clipping) işlemidir. Ortalama olduğu gibi 100,49, silince 46,27, kırpınca 50,79. Ama 480 gerçek bir kurumsal müşteri olabilir; silmek satırı atar, kırpmak tutar.',
      labText: `Müdahaleyi yok, sil ve kırp arasında değiştir, uç değeri oynat. Ortalamanın her seçenekte aldığı değer sahnede canlı okunur.`,
      term: 'kırpma (clipping)',
      params: { ...P2, action: 'kirp' },
    },
  ],
};

const FILLS: Fill[] = ['yok', 'ortalama', 'medyan'];
const ACTIONS: Action[] = ['yok', 'sil', 'kirp'];

function nextOf<T>(list: readonly T[], v: T): T {
  return list[(list.indexOf(v) + 1) % list.length];
}

/** Teacher shortcuts: manual overrides on top of the current step, each only in its own part. */
export function iqrShortcuts(player: StepPlayer<IqrParams>): Shortcut[] {
  const p = (): IqrParams => player.state.params;
  const inPart1 = (): boolean => player.state.index <= PART1_LAST;
  return [
    {
      keys: ['d', 'D'], display: 'D', label: 'Doldurma: yok / ortalama / medyan',
      run: () => { if (inPart1()) player.setParam('fill', nextOf(FILLS, p().fill)); },
    },
    {
      keys: ['k', 'K'], display: 'K', label: 'IQR katsayısı: 1,5 / 3,0',
      run: () => { if (!inPart1()) player.setParam('k', p().k === 1.5 ? 3 : 1.5); },
    },
    {
      keys: ['c', 'C'], display: 'C', label: 'Müdahale: yok / sil / kırp',
      run: () => { if (!inPart1()) player.setParam('action', nextOf(ACTIONS, p().action)); },
    },
  ];
}
