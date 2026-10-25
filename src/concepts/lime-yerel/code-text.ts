import type { CodeBug, CodeLine } from '../../core/plot/code-panel';
import { BOOK } from '../xai/data';

/** The five bugs of the book's `HataAyiklama` exercise (its "Hata türleri" list, in the book's order). */
export const BUGS: readonly CodeBug[] = [
  { n: 1, kind: 'tür hatası', what: 'sınıf örneklenmemiş' },
  { n: 2, kind: 'mantık hatası', what: 'tek satır iki boyutlu değil' },
  { n: 3, kind: 'indeksleme hatası', what: 'predict_proba eksenleri eksik' },
  { n: 4, kind: 'mantık hatası', what: 'tanımsız tahmin_olasiligi' },
  { n: 5, kind: 'veri biçimi hatası', what: 'DataFrame yerine Series' },
];

const line = (text: string, extra: Partial<CodeLine> = {}): CodeLine => ({ text, bugs: [], ...extra });

/** The book's faulty code, verbatim (header comments included). Bug 5 sits on the `shap_values` call that receives the Series. */
export const BUGGY_CODE: readonly CodeLine[] = [
  line('# File: HataAyiklama.python'),
  line('# Bu kod, yerel açıklama hazırlarken çeşitli mantık ve tür hataları içermektedir.'),
  line('# Amaç hataları tanımlamak ve güvenilir bir açıklama üretmektir.'),
  line('# Çıktı satırı ayrıca yanlış değişken kullanmaktadır.'),
  line(''),
  line('import shap'),
  line('from sklearn.ensemble import RandomForestClassifier'),
  line(''),
  line('model = RandomForestClassifier', { bugs: [1] }),
  line('model.fit(egitim_ozellikleri, egitim_hedefi)'),
  line(''),
  line('musteri = test_ozellikleri.iloc[0]', { bugs: [2] }),
  line('olasilik = model.predict_proba(musteri)[1]', { bugs: [3] }),
  line(''),
  line('aciklayici = shap.TreeExplainer(model)'),
  line('degerler = aciklayici.shap_values(musteri)', { bugs: [5] }),
  line('print(f"Olasılık: {tahmin_olasiligi}")', { bugs: [4] }),
];

/** The book's corrected code; each changed line lists the bugs it fixes (bug 5, Series instead of DataFrame, is fixed by the `iloc[[0]]` line); its output comment carries the probability this data gives (the book prints another number). */
export const FIXED_CODE: readonly CodeLine[] = [
  line('# File: HataAyiklama.python'),
  line('# Model örneklenir ve eğitim verisiyle eğitilir.'),
  line('# Tek müşteri DataFrame biçiminde seçilir.'),
  line('# Olasılık doğru sınıf indeksinden alınır.'),
  line(''),
  line('import shap'),
  line('from sklearn.ensemble import RandomForestClassifier'),
  line(''),
  line('model = RandomForestClassifier(n_estimators=100, random_state=42)', { fix: true, bugs: [1] }),
  line('model.fit(egitim_ozellikleri, egitim_hedefi)'),
  line(''),
  line('musteri = test_ozellikleri.iloc[[0]]', { fix: true, bugs: [2, 5] }),
  line('olasilik = model.predict_proba(musteri)[0, 1]', { fix: true, bugs: [3] }),
  line(''),
  line('aciklayici = shap.TreeExplainer(model)'),
  line('degerler = aciklayici.shap_values(musteri)'),
  line(''),
  line('print(f"Olasılık: %{olasilik * 100:.1f}")', { fix: true, bugs: [4] }),
  line(''),
  line(`# Çıktı: Olasılık: %${(BOOK.fixedCodeP * 100).toFixed(1)}`),
];
