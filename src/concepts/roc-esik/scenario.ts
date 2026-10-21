import type { Scenario } from '../../core/player';
export interface RocParams { threshold: number; nonePositive: boolean; dataset: 'balanced' | 'imbalanced'; fpCost: number; fnCost: number }
const defaults: RocParams = { threshold: .5, nonePositive: false, dataset: 'balanced', fpCost: 1, fnCost: 5 };
const moments = [
  ['skor','Skor etiket değildir','Doğrulama müşterileri skorlarına göre yerleşir. İç şekil gerçek sınıftır. Skor, kalibre olasılık garantisi değildir.','skor ve gerçek sınıf'],
  ['esik','0,50 ile karar ver','Skor ≥ eşik ise müşteri için ayrılır kararı veririz. Çizginin iki yanı tahmin bölgeleridir; matris aynı müşterileri sayar.','karar eşiği'],
  ['dusur','Eşiği düşür','Çizgi sola kayar; daha çok müşteriye teklif verilir. Recall artabilir, FP artabilir. Precision her örnekte monoton değildir.','bağlı skorlar birlikte değişir'],
  ['yukselt','Eşiği yükselt','Çizgi sağa kayar. Gereksiz teklifler azalabilir, ayrılan müşteriler kaçabilir. Precision, recall ve F1 aynı matrise dayanır.','precision / recall / F1'],
  ['roc','Bütün eşikleri ROC üzerinde gör','Her farklı skor bir adaydır. Tüm-negatif başlangıç (0,0), tüm-pozitif bitiş (1,1). Nokta = (FPR, TPR). Diyagonal rastgele sıralama referansıdır.','ROC: FPR ve TPR'],
  ['auc','Sıralamanın alanı: ROC-AUC','Trapez alanı modelin sıralamasını özetler. Eşiği değiştirince seçili nokta hareket eder; aynı skorların AUC değeri sabit kalır.','ROC-AUC · trapez alanı'],
  ['pr','Pozitif tahminlere yakından bak','PR: x recall, y precision. AP = Σ Δrecall × precision; basamak alanıdır, trapez PR-AUC değildir. Boş pozitif tahminde çizim için precision=1; metrik kartında precision tanımsızdır.','Average precision (AP)'],
  ['dengesizlik','Pozitif oranını değiştir','Dengeli ve dengesiz doğrulama örneklerini karşılaştırın. ROC referansı diyagonal; PR referansı örneğin pozitif oranıdır. Farklı örneklerde AUC değişebilir.','sınıf dengesizliği'],
  ['maliyet','İş hedefine göre eşik seç','Doğrulamada FP × birim maliyet + FN × birim maliyeti en aza indirin. Eşitlikte daha yüksek eşik seçilir: daha az müşteriye teklif verme tercihi.','doğrulamada maliyet taraması'],
  ['test','Eşiği dondur, testi aç','Eğitim → doğrulamada eşik seçimi → bağımsız test. Eşik yalnız doğrulamada seçilir. Test etiketleri, skorları ve adayları seçime girmez.','test yalnız son rapor içindir'],
] as const;
export const rocScenario: Scenario<RocParams> = { defaults, steps: moments.map(([id,title,text,term], index) => ({ id,title,text,term,params:{...defaults}, ...(index===2||index===3?{sweep:{key:'threshold' as const,values:index===2?[.8,.5,.3,.1]:[.1,.3,.5,.8],intervalMs:1200}}:{}) })) };
export const rocEsikScenario = rocScenario;
