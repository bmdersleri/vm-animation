import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import { QUERY } from './data';
import type { Unit } from './space';

/** mu: mean and sigma in raw space; kaydir: x - mu; standard: z. */
export type Scaling = 'yok' | 'mu' | 'kaydir' | 'standard';
export type Fit = 'egitim' | 'tum';

export interface OlcParams {
  unit: Unit;
  scaling: Scaling;
  fit: Fit;
  query: { t: number; f: number };
}

export const UNIT_SWEEP_MS = 1800;
const UNIT_SWEEP: Unit[] = ['ay', 'yil', 'gun'];

/** Steps with a scatter: U, S and Lab drag work here (step 7 is the three-scaler view). */
export const SCATTER_STEPS: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 8];
/** Steps on the 006 split data: T works here. */
export const FIT_STEPS: readonly number[] = [10, 11, 12];

const q = (): { t: number; f: number } => ({ ...QUERY });

export const olceklemeScenario: Scenario<OlcParams> = {
  defaults: { unit: 'ay', scaling: 'yok', fit: 'egitim', query: q() },
  steps: [
    {
      id: 'iki-olcek',
      title: 'İki farklı ölçek',
      text: 'Altı müşteri iki sütunla anlatılıyor: hizmet süresi 1–60 ay, aylık fatura 29,85–200 TL. İki sütunun ölçeği (scale) birbirinden çok farklı.',
      term: 'ölçek (scale)',
      params: { unit: 'ay', scaling: 'yok', fit: 'egitim', query: q() },
    },
    {
      id: 'en-yakin',
      title: 'En yakın komşu',
      text: 'Yeni müşteri 12 ay, 55 TL ile gelir. Öklid uzaklığı (Euclidean distance) her müşteriye çizilir; en yakını M3: √((12 − 2)² + (55 − 42,30)²) = √(100 + 161,29) = 16,16.',
      term: 'Öklid uzaklığı (Euclidean distance)',
      params: { unit: 'ay', scaling: 'yok', fit: 'egitim', query: q() },
    },
    {
      id: 'birim',
      title: 'Birim değişince komşu değişir',
      text: 'Hizmet süresini aya, yıla, güne çevirince en yakın komşu M3, M2, M5 olur. Birim (unit) değişti, müşteriler değişmedi.',
      term: 'birim (unit)',
      params: { scaling: 'yok', fit: 'egitim', query: q() },
      sweep: { key: 'unit', values: [...UNIT_SWEEP], intervalMs: UNIT_SWEEP_MS },
    },
    {
      id: 'ortalama-sapma',
      title: 'Ortalama ve sapma',
      text: 'Hizmet süresinin ortalaması 25, standart sapması (standard deviation) 22,73; faturanın ortalaması 72,95, sapması 58,29. Bu iki sayı ham uzayda işaretlenir.',
      term: 'standart sapma (standard deviation)',
      params: { unit: 'ay', scaling: 'mu', fit: 'egitim', query: q() },
    },
    {
      id: 'kaydir',
      title: 'Kaydır: x − μ',
      text: 'Her değerden ortalama çıkarılır; bulut orijine kayar. Bu işleme merkezleme (centering) denir; yayılma henüz aynı.',
      term: 'merkezleme (centering)',
      params: { unit: 'ay', scaling: 'kaydir', fit: 'egitim', query: q() },
    },
    {
      id: 'bol',
      title: 'Böl: ÷ σ',
      text: 'Kaydırılan değerler standart sapmaya bölünür. Standardizasyon (z-score) sonrası iki eksen aynı ölçekte: (200 − 72,95) / 58,29 = 2,18.',
      term: 'standardizasyon (z-score)',
      params: { unit: 'ay', scaling: 'standard', fit: 'egitim', query: q() },
    },
    {
      id: 'birim-fark-etmez',
      title: 'Birim artık fark etmez',
      text: 'Ay, yıl, gün: z değerleri aynı kalır ve en yakın komşu hep M3 (0,49). Bu ölçekten bağımsızlık (scale invariance) ölçeklemenin amacıdır.',
      term: 'ölçekten bağımsızlık (scale invariance)',
      params: { scaling: 'standard', fit: 'egitim', query: q() },
      sweep: { key: 'unit', values: [...UNIT_SWEEP], intervalMs: UNIT_SWEEP_MS },
    },
    {
      id: 'uc-olcekleyici',
      title: 'Üç ölçekleyici',
      text: 'Fatura sütunu üç sayı doğrusunda: StandardScaler, MinMaxScaler, RobustScaler. MinMaxScaler 200 değerini 1’e götürür, diğer beşi 0 ile 0,24 arasına sıkışır; RobustScaler kalabalığı açık bırakır.',
      term: 'MinMaxScaler, RobustScaler',
      params: { unit: 'ay', scaling: 'standard', fit: 'egitim', query: q() },
    },
    {
      id: 'transform',
      title: 'Yeni müşteri: yalnızca transform',
      text: 'Yeni müşteri, eğitimden öğrenilen μ ve σ ile dönüşür: ((12 − 25) / 22,73; (55 − 72,95) / 58,29) = (−0,57; −0,31). fit / transform ayrımında fit yalnızca öğrenir, yeni veri yalnızca transform edilir.',
      term: 'fit / transform',
      params: { unit: 'ay', scaling: 'standard', fit: 'egitim', query: q() },
    },
    {
      id: 'ayir',
      title: 'Önce ayır',
      text: 'On fatura tek sayı doğrusunda. Önce eğitim-test ayrımı (train-test split) yapılır: yedi eğitim, üç test noktası. Churn oranı eğitimde 0,29, testte 0,33.',
      term: 'eğitim-test ayrımı (train-test split)',
      params: { unit: 'ay', scaling: 'yok', fit: 'egitim', query: q() },
    },
    {
      id: 'egitimden',
      title: 'Eğitimden öğren',
      text: 'μ ve σ yalnızca eğitim noktalarından hesaplanır: μ = 58,63, σ = 19,26. Bu öğrenilen parametreler (learned parameters) test noktalarını −0,71, −1,33, −1,04 değerlerine dönüştürür.',
      term: 'öğrenilen parametreler (learned parameters)',
      params: { unit: 'ay', scaling: 'yok', fit: 'egitim', query: q() },
    },
    {
      id: 'sizinti',
      title: 'Yanlış sıra: sızıntı',
      text: 'Ölçekleyici on noktanın tümüyle fit edilirse test verisi hesaba karışır: μ = 52,69, σ = 18,69 olur ve test z değerleri −0,41, −1,05, −0,76’ya kayar. Buna veri sızıntısı (data leakage) denir.',
      term: 'veri sızıntısı (data leakage)',
      params: { unit: 'ay', scaling: 'yok', fit: 'tum', query: q() },
    },
    {
      id: 'altin-kural',
      title: 'Altın kural',
      text: 'Önce ayır, yalnızca eğitimde fit et, sonra eğitimi ve testi transform et. Pipeline bu sırayı yapısal olarak zorlar.',
      term: 'Pipeline',
      params: { unit: 'ay', scaling: 'yok', fit: 'egitim', query: q() },
    },
  ],
};

/** Teacher shortcuts: each acts only in the steps where its control is visible. */
export function olcShortcuts(player: StepPlayer<OlcParams>): Shortcut[] {
  const p = (): OlcParams => player.state.params;
  const inSteps = (list: readonly number[]): boolean => list.includes(player.state.index);
  return [
    {
      keys: ['u', 'U'], display: 'U', label: 'Birim: ay / yıl / gün',
      run: () => {
        if (inSteps(SCATTER_STEPS)) player.setParam('unit', UNIT_SWEEP[(UNIT_SWEEP.indexOf(p().unit) + 1) % UNIT_SWEEP.length]);
      },
    },
    {
      keys: ['s', 'S'], display: 'S', label: 'Ölçekleme: yok / StandardScaler',
      run: () => {
        if (inSteps(SCATTER_STEPS)) player.setParam('scaling', p().scaling === 'standard' ? 'yok' : 'standard');
      },
    },
    {
      keys: ['t', 'T'], display: 'T', label: 'fit kapsamı: yalnız eğitim / tüm veri',
      run: () => {
        if (inSteps(FIT_STEPS)) player.setParam('fit', p().fit === 'egitim' ? 'tum' : 'egitim');
      },
    },
  ];
}
