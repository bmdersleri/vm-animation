import type { Scenario, StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { Scaling } from './data';
import { VT_OPTIONS, type VtThreshold } from './select';

export interface SecimParams {
  /** VarianceThreshold threshold. */
  vt: VtThreshold;
  /** SelectKBest k, 1-7. */
  k: number;
  /** RFE n_features_to_select, 1-7. */
  nSelect: number;
  scaling: Scaling;
  /** RFE rounds shown; ROUNDS_ALL means every round of the chosen nSelect. */
  rounds: number;
}

export const ROUNDS_ALL = 99;
export const RFE_SWEEP_MS = 1200;
export const RFE_REPLAY_MS = 900;

/** Steps where V works. */
export const VT_STEPS: readonly number[] = [1];
/** Steps where the k slider is the lesson. */
export const K_STEPS: readonly number[] = [2, 3, 4];
/** Steps where nSelect, the scaling and S work. */
export const RFE_STEPS: readonly number[] = [5, 6, 7, 8, 9];

const B = { vt: 0.01 as VtThreshold, k: 4, nSelect: 4 };
const YOK = { ...B, scaling: 'yok' as Scaling };

export const ozellikSecimiScenario: Scenario<SecimParams> = {
  defaults: { ...YOK, rounds: 0 },
  steps: [
    {
      id: 'sekiz-sutun',
      title: 'Sekiz sütun',
      text: '400 müşteri, 8 sütun, churn %42,25. Her sütun bir öznitelik (feature); hepsi modele girmeyi hak etmiyor. Hangilerini tutacağımıza karar vermek özellik seçimidir (feature selection).',
      term: 'öznitelik (feature) · özellik seçimi (feature selection)',
      params: { ...YOK, rounds: 0 },
    },
    {
      id: 'varyans-esigi',
      title: 'Varyans eşiği',
      text: 'En ucuz eleme hedefe hiç bakmadan yapılır: varyansı eşiğin altında kalan sütun atılır. Bu bir filtre yöntemidir (filter method). Eşik 0,01 iken yalnız sabitDeger elenir.',
      term: 'filtre yöntemi (filter method)',
      params: { ...YOK, rounds: 0 },
    },
    {
      id: 'f-skoru',
      title: 'F-skoru',
      text: 'Her sütunun churn ile ilişkisini ANOVA F-istatistiği (ANOVA F-statistic) ölçer. Puanlar büyükten küçüğe dizilir; sabitDeger’in puanı tanımsızdır ve en sonda kalır.',
      term: 'ANOVA F-istatistiği (ANOVA F-statistic)',
      params: { ...YOK, rounds: 0 },
    },
    {
      id: 'ilk-dort',
      title: 'İlk dört',
      text: 'SelectKBest en büyük dört F’ye sahip sütunu tutar: hizmetSayisi, musteriKidemAy, destekTaleplerinSayisi ve odemeGecikmesi. Gerisi elenir.',
      term: 'SelectKBest',
      params: { ...YOK, rounds: 0 },
    },
    {
      id: 'tek-basina',
      title: 'Neden kıdem yüksek, gürültü düşük?',
      text: 'Her sütun tek başına değerlendirilir (univariate): filtre etkileşimi görmez. 12 ayın altındaki her müşteri churn ediyor; churn etmeyenlerin şeridi orada boş, bu yüzden kıdemin F’si yüksek. Gürültülü öznitelikte iki grup üst üste biner.',
      term: 'tek değişkenli değerlendirme (univariate)',
      params: { ...YOK, rounds: 0 },
    },
    {
      id: 'rfe-tur-1',
      title: 'RFE, tur 1',
      text: 'Sarmalayıcı yöntem (wrapper method) modeli kendi içinde dener: lojistik regresyonun |katsayı|’sı en küçük sütun elenir. İlk turda toplamUcret gider.',
      term: 'sarmalayıcı yöntem (wrapper method)',
      params: { ...YOK, rounds: 1 },
    },
    {
      id: 'turlar',
      title: 'Turlar 2–4',
      text: 'RFE (Recursive Feature Elimination) her turda modeli yeniden eğitir ve en zayıf sütunu atar; çubuklar her turda yeniden boylanır. Dört tur sonunda dört sütun kalır.',
      term: 'RFE (Recursive Feature Elimination)',
      params: { ...YOK, rounds: ROUNDS_ALL },
      sweep: { key: 'rounds', values: [1, 2, 3], intervalMs: RFE_SWEEP_MS },
    },
    {
      id: 'gurultu-secildi',
      title: 'Gürültü seçildi',
      text: 'Kalanlar arasında gurultuluOznitelik var. Neden: ölçek (scale). Gürültünün σ’sı 0,92, kıdeminki 17,40; ölçeksiz katsayı küçük ölçekli sütunu büyük gösterir. Kitabın Hata 2’si budur.',
      term: 'ölçek (scale)',
      params: { ...YOK, rounds: ROUNDS_ALL },
    },
    {
      id: 'olceklenince',
      title: 'Ölçekleyince',
      text: 'StandardScaler sütunları aynı ölçeğe getirir ve RFE baştan oynar. Gürültü bu kez de içeride kalıyor: sarmalayıcı yöntemler de kusursuz değil.',
      term: 'StandardScaler',
      params: { ...B, scaling: 'standard', rounds: ROUNDS_ALL },
      sweep: { key: 'rounds', values: [0, 1, 2, 3], intervalMs: RFE_REPLAY_MS },
    },
    {
      id: 'kesisim',
      title: 'Kesişim ve kural',
      text: 'Birden fazla yöntemin kesişimi (intersection) daha güvenilir: SelectKBest ile RFE’nin ortak seçtikleri musteriKidemAy, destekTaleplerinSayisi ve odemeGecikmesi. Seçim de yalnız eğitim verisiyle fit edilir.',
      term: 'kesişim (intersection)',
      params: { ...YOK, rounds: ROUNDS_ALL },
    },
  ],
};

/** Teacher shortcuts: each acts only in the steps where its control is visible. */
export function secimShortcuts(player: StepPlayer<SecimParams>): Shortcut[] {
  const inSteps = (list: readonly number[]): boolean => list.includes(player.state.index);
  return [
    {
      keys: ['v', 'V'], display: 'V', label: 'Varyans eşiği: 0 / 0,01 / 1 / 10',
      run: () => {
        if (!inSteps(VT_STEPS)) return;
        const i = VT_OPTIONS.indexOf(player.state.params.vt);
        player.setParam('vt', VT_OPTIONS[(i + 1) % VT_OPTIONS.length]);
      },
    },
    {
      keys: ['s', 'S'], display: 'S', label: 'Ölçekleme: yok / StandardScaler',
      run: () => {
        if (inSteps(RFE_STEPS)) player.setParam('scaling', player.state.params.scaling === 'yok' ? 'standard' : 'yok');
      },
    },
  ];
}
