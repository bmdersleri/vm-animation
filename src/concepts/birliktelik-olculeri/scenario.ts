import type { Scenario } from '../../core/player';
import { sepetData, type Item } from '../birliktelik/data';
import { setBraces, setNames } from '../birliktelik/format';
import { rules } from '../birliktelik/rules';
import { formatTrim } from '../../core/plot/format';
import { basketLine, measures, percentText, ratioText, spotGroups } from './view';

export interface BirliktelikOlculeriParams {
  /** Antecedent (X) and consequent (Y) items. */
  x: Item[];
  y: Item[];
  /** Thresholds of the rule scatter (steps 9-10). */
  minSupport: number;
  minConfidence: number;
  minLift: number;
  /** Lab cell edits: codes `row * items + column`; a code listed an odd number of times toggles that cell. */
  edits: number[];
}

/** The book's thresholds (Blok 6) and the lift filter of step 10. */
export const MIN_SUPPORT = 0.2;
export const MIN_CONFIDENCE = 0.5;
export const FILTER_LIFT = 1.1;

const tx = sepetData.transactions;
const n = tx.length;
const items = sepetData.items.length;
const [EKMEK, SUT, YUMURTA] = ['ekmek', 'sut', 'yumurta'];
const ES = measures(tx, [EKMEK], [SUT]);
const SE = measures(tx, [SUT], [EKMEK]);
const YS = measures(tx, [YUMURTA], [SUT]);
const SY = measures(tx, [SUT], [YUMURTA]);
const all = rules(tx, MIN_SUPPORT, MIN_CONFIDENCE);
const kept = all.filter((r) => r.lift > FILTER_LIFT + 1e-9);
const top = kept[0];
/** Scatter points: rules with the same support and confidence share one. */
const spots = spotGroups(all).length;
const EXAMPLE_BASKET = 3;
const th = (v: number): string => formatTrim(v, 2);

const base = { minSupport: MIN_SUPPORT, minConfidence: MIN_CONFIDENCE, minLift: 0 };

export const birliktelikOlculeriScenario: Scenario<BirliktelikOlculeriParams> = {
  defaults: { x: [], y: [], ...base, edits: [] },
  steps: [
    {
      id: 'fisler',
      title: 'Fişler',
      text: `${n} kasa fişi; her fiş bir müşterinin tek alışverişi, yani bir sepet. Örnek, ${basketLine(tx, EXAMPLE_BASKET)}. Her satır tek bir alışveriş.`,
      labText: 'Fiş numarasını seç, ürün düğmeleriyle o fişe ürün ekle ya da fişten ürün çıkar; liste anında değişir. Sıfırla düğmesi kitaptaki fişlere döner.',
      params: { x: [], y: [] },
    },
    {
      id: 'tablo',
      title: 'İşlem–öğe tablosu',
      text: `Liste one-hot tabloya dönüşür (TransactionEncoder): ${n} satır × ${items} sütun. Dolu hücre, ürünün o sepette olduğunu gösterir; sütun altlarında her ürünün kaç fişte geçtiği yazar.`,
      labText: 'Bir hücreye tıkla ya da ok tuşlarıyla gezinip Boşluk tuşuna bas: ürün o fişe eklenir ya da fişten çıkarılır. Sütun altındaki sayılar anında güncellenir. Sıfırla düğmesi kitaptaki fişlere döner.',
      term: 'one-hot kodlama',
      params: { x: [], y: [] },
    },
    {
      id: 'destek-tek',
      title: 'Destek: tek ürün',
      text: `${setNames([EKMEK])} sütununda ${ES.cx} dolu hücre var: destek(${setNames([EKMEK])}) = ${ES.cx} / ${n} = ${ratioText(ES.cx / n)}. Destek, bir ürünün fişlerin ne kadarında geçtiğini söyler. Altta bütün ürünlerin destek çubukları.`,
      labText: 'Bir ürün seç ve sütunundaki dolu hücrelerin sayıldığını izle; sepeti düzenleyince sayı, oran ve çubuklar değişir.',
      term: 'destek (support)',
      params: { x: [EKMEK], y: [] },
    },
    {
      id: 'destek-cift',
      title: 'Destek: ürün çifti',
      text: `${setBraces([EKMEK, SUT])} kümesi: ikisini birden içeren ${ES.cxy} fiş var, destek = ${ES.cxy} / ${n} = ${ratioText(ES.support)}. Küme büyüdükçe destek artmaz.`,
      labText: 'Öncül ve sonuç ürünlerini seç; seçilen ürünlerin hepsini birlikte içeren fişler sayılır. Sepeti düzenleyince küme desteği değişir.',
      params: { x: [EKMEK], y: [SUT] },
    },
    {
      id: 'guven',
      title: 'Güven: Ekmek → Süt',
      text: `Kural: ${setNames([EKMEK])} → ${setNames([SUT])}. ${setNames([EKMEK])} içeren ${ES.cx} fiş öne çıkar, diğerleri soluklaşır; bunların ${ES.cxy} tanesinde ${setNames([SUT])} de var: güven = ${ES.cxy} / ${ES.cx} = ${ratioText(ES.confidence)}. Yani ${setNames([EKMEK])} içeren fişlerin ${percentText(ES.confidence ?? 0)} kadarında ${setNames([SUT])} de var.`,
      labText: 'Öncül ve sonuç ürünlerini değiştir: öncülü içeren fişler öne çıkar, diğerleri soluklaşır; bu fişlerin kaçında sonucun da bulunduğu sayılır. Sepeti düzenleyince oran değişir.',
      term: 'güven (confidence)',
      params: { x: [EKMEK], y: [SUT] },
    },
    {
      id: 'guven-yon',
      title: 'Güven yönlüdür',
      text: `${setNames([SUT])} → ${setNames([EKMEK])}: ${setNames([SUT])} içeren ${SE.cx} fiş var, bunların ${SE.cxy} tanesinde ${setNames([EKMEK])} de var; güven = ${SE.cxy} / ${SE.cx} = ${ratioText(SE.confidence)}. Destek aynı (${SE.cxy} / ${n}), güven farklı: payda değişti.`,
      labText: 'Öncül ile sonucu yer değiştir ve paydanın nasıl değiştiğine bak. Destek iki yönde aynı kalır, güven aynı kalmaz.',
      params: { x: [SUT], y: [EKMEK] },
    },
    {
      id: 'tuzak',
      title: 'Yüksek güven tuzağı',
      text: `${setNames([EKMEK])} → ${setNames([SUT])} güveni ${ratioText(ES.confidence)}, ama ${setNames([SUT])} zaten fişlerin ${ES.cy} / ${n} = ${ratioText(ES.base)} kadarında var (taban oran). Lift (ilgi oranı) = ${ratioText(ES.confidence)} / ${ratioText(ES.base)} = ${ratioText(ES.lift)} < 1: ${setNames([EKMEK])} alan biri ${setNames([SUT])} almaya daha az yatkın. Lift 1 civarındaysa ürünler birbirinden bağımsızdır; kural bir şey söylemez.`,
      labText: 'Güven çubuğunu kesikli taban çizgisiyle karşılaştır: çubuk çizgiyi geçiyorsa lift birden büyüktür, çizgiye ulaşmıyorsa birden küçüktür.',
      term: 'lift (ilgi oranı)',
      params: { x: [EKMEK], y: [SUT] },
    },
    {
      id: 'gercek',
      title: 'Gerçek bir birliktelik',
      text: `${setNames([YUMURTA])} → ${setNames([SUT])}: güven ${YS.cxy} / ${YS.cx} = ${ratioText(YS.confidence)}, taban oran ${ratioText(YS.base)}, lift ${ratioText(YS.lift)}. Lift simetriktir: ${setNames([SUT])} → ${setNames([YUMURTA])} için de ${ratioText(SY.lift)} (güveni ${ratioText(SY.confidence)} olsa da).`,
      labText: 'Başka bir ürün çifti dene: lift iki yönde de aynı çıkar, güven çoğu zaman farklıdır. Çubuk ile taban çizgisi arasındaki fark, kuralın taban orana ne kattığını gösterir.',
      params: { x: [YUMURTA], y: [SUT] },
    },
    {
      id: 'kurallar',
      title: 'Bütün kurallar',
      text: `min_support ${th(MIN_SUPPORT)} ve min güven ${th(MIN_CONFIDENCE)} ile ${all.length} kural çıkar (association_rules). Saçılımda her daire bir kural: yatay eksen destek, dikey eksen güven; dairenin boyu lift ile büyür. Lift'i 1'den büyük kurallar dolu, 1 ya da daha küçük olanlar içi boş çizilir; ${setNames([EKMEK])} → ${setNames([SUT])} işaretli. Desteği ve güveni aynı olan kurallar üst üste düşer: ${all.length} kural ${spots} noktada görünür.`,
      labText: 'Destek, güven ve lift kaydırıcılarını oynat: kural sayısı ve saçılım anında değişir; lift kaydırıcısı en düşük konumdayken süzgeç kapalıdır. Bir noktaya tıklamak o kuralı seçer; üst üste düşen kurallar arasında geçmek için aynı noktaya yeniden tıkla. Fiş düzenleyerek sepeti de değiştirebilirsin.',
      term: 'birliktelik kuralı',
      params: { x: [EKMEK], y: [SUT], ...base, minLift: 0 },
    },
    {
      id: 'suzgec',
      title: 'Lift ile süz',
      text: `lift > ${th(FILTER_LIFT)} süzgeci ${kept.length} kuralı bırakır; lift'i ${th(FILTER_LIFT)} ve altında kalan ${all.length - kept.length} kural soluklaşır. En üstte ${setBraces(top.x)} → ${setNames(top.y)} (güven ${ratioText(top.confidence)}, lift ${ratioText(top.lift)}). Lift birlikteliği ölçer, nedenselliği değil.`,
      labText: 'Lift eşiğini değiştir ve hangi kuralların soluklaştığına bak. Güven ile destek eşikleri de kural sayısını belirler. mlxtend çıktısındaki leverage sütunu kaldıraçtır (leverage): lift’in oranı yerine farkı kullanır, destek(X∪Y) − destek(X)·destek(Y). conviction da ayrı bir ölçüttür.',
      params: { x: [EKMEK], y: [SUT], ...base, minLift: FILTER_LIFT },
    },
  ],
};
