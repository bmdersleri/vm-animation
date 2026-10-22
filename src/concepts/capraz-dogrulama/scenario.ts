import type { Scenario } from '../../core/player';

export interface CvParams { k:3|5; method:'kfold'|'stratified'; fold:number; c:.1|1 }
export type CaprazDogrulamaParams=CvParams;
const defaults:CvParams={k:5,method:'stratified',fold:0,c:1};
const moments=[
  ['tek-bolunme','Bir bölünme, bir sonuç','Geliştirme verisi eğitim ve doğrulamaya ayrılır. Bir turun sonucu, hangi müşterilerin doğrulamada kaldığına bağlıdır. Dış test baştan ayrılır.','doğrulama kümesi (validation set)'],
  ['katlar','Geliştirme verisini K parçaya ayır','Kimlikler sabit kalır. Her parça başka bir turda doğrulama görevini alır. Dış test katlara girmez.','kat (fold) · K-Fold'],
  ['ilk-kat','Bir kat doğrulamada, kalanı eğitimde','Kesikli çerçeveli kat doğrulama için saklanır. Eğitim ve doğrulama kimlikleri kesişmez. İç şekil gerçek sınıftır; çerçeve veri rolüdür.','doğrulama katı (validation fold)'],
  ['yeni-model','Her tur yeni model','Her turda StandardScaler ve LogisticRegression baştan, yalnız o turun eğitim verisiyle fit edilir. Doğrulama kimlikleri, parametreler ve F1 birlikte değişir.','her turda yeniden fit (refit)'],
  ['her-ornek','Her örnek bir kez doğrulamada','K turluk döngüde her müşteri bir kez doğrulamaya, K−1 kez eğitime girer. Kimliğin yanındaki K numarası doğrulama katıdır.','K katlı çapraz doğrulama (K-fold cross-validation)'],
  ['ozet','Ortalama ve yayılmayı birlikte oku','Çubuklar kat F1 skorlarıdır. Aritmetik ortalama ve popülasyon standart sapması (ddof=0) bölünmeler arası değişimi özetler; bu bir güven aralığı değildir.','ortalama ve standart sapma (mean, std)'],
  ['duz-kfold','Dengesiz veride düz K-Fold','Aynı müşteriler, karıştırılmadan düz K-Fold ile bölünür. Bazı doğrulama katlarında pozitif sınıf yoktur; recall tanımsızdır. F1 kendi paydasına göre değerlendirilir.','düz K-Fold (KFold)'],
  ['stratified','Sınıf oranını katlara taşı','StratifiedKFold sınıf oranlarını yaklaşık korur. Kimlikler kalır, kat atamaları değişir. Her sınıfın örnek sayısı K için yeterli olmalıdır.','katmanlı K-Fold (StratifiedKFold)'],
  ['pipeline','Pipeline her turun içinde','Ölçekleyici yalnız eğitimde fit edilir. Doğrulama bu parametrelerle dönüştürülür. Tüm geliştirme verisinde önce fit etmek, doğrulama bilgisini eğitime taşır.','Pipeline · veri sızıntısı (data leakage)'],
  ['son-test','Seç, yeniden fit et, sonra testi aç','Sabit K=5 StratifiedKFold protokolünde C=0,1 ve C=1 karşılaştırılır. Ortalama F1 ile seçim yapılır; eşitlikte küçük C seçilir. Seçilen Pipeline tüm geliştirmede yeniden fit edilir, dış test bir kez raporlanır.','model seçimi ve dış test (held-out test)'],
] as const;
// The step-4 sweep key stays out of its params, so the last turn stays on screen when the sweep ends.
const stepParams=(i:number):Partial<CvParams>=>{
  if(i===3){const {k,method,c}=defaults;return {k,method,c};}
  return {...defaults,...(i===6?{method:'kfold' as const}:{})};
};
/** Step 7 is the one lesson text that states a result (some folds have no positives) which the Lab method select can undo. */
const labTexts:Record<string,string>={'duz-kfold':'Yöntem seçicisini düz K-Fold ile StratifiedKFold arasında değiştir. Pozitif sınıfı olmayan katlar ve tanımsız recall, kat paneli ile çubuklarda canlı okunur.'};
export const cvScenario:Scenario<CvParams>={defaults,steps:moments.map(([id,title,text,term],i)=>({id,title,text,term,...(labTexts[id]?{labText:labTexts[id]}:{}),params:stepParams(i),...(i===3?{sweep:{key:'fold' as const,values:[0,1,2,3,4],intervalMs:1200}}:{})}))};
export const caprazDogrulamaScenario=cvScenario;
