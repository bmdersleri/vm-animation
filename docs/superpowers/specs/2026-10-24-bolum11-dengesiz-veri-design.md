# Bölüm 11 — Dengesiz veri: doğruluk tuzağı, SMOTE, sınıf ağırlığı, SMOTE sızıntısı ve PR-AUC — Tasarım

- **Tarih:** 2026-10-24
- **Kaynak:** Öğretmen: "onayladım, yayınla ve bölüm 11 ile devam et"; soru sorulmaması kuralı
  Bölüm 9'dan sürer ("soruları atla, sen öner ve başla"). Kitabın
  `ch11_dengesiz_veri_ve_tuzaklar/content/final.md` bölümü ve
  `datasets/telco_churn_synthetic_severe.csv` (salt okunur).
- **Yetki:** Bütün tasarım kararları benimdir (aşağıda "Benim kararım"). Kararlar ledger'da
  `Ruling:` satırı olarak da durur ve iş sonunda öğretmene listelenir. Yayın (main'e push) için
  öğretmenin onayı ayrıca beklenir.
- **Önceki tasarımlar:** Bölüm 10 (`2026-10-24-bolum10-gradyan-artirma-design.md`); ortak görünüm
  kuralları ve iki sayfa kalıbı oradan devralınır. PR eğrisi ve eşik maliyeti Bölüm 6'nın
  `roc-esik/` sayfasında; burada yalnız dengesizlik açısından kullanılır.
- **Ön deneme (2026-10-24, scikit-learn 1.9.0; `imbalanced-learn` kurulu değil, SMOTE elle
  yazıldı: azınlıktan rastgele x_i, 5 en yakın azınlık komşusundan rastgele biri, λ ∈ [0; 1)):**
  - Veri: 2000 müşteri, 124 ayrılan (%6,2). Katmanlı 70/30 bölme (`random_state=42`): eğitim
    1313 / 87, test 563 / 37.
  - Kitabın `bolum11_kod01` modeli birebir: test karışıklık matrisi [[563, 0], [37, 0]],
    doğruluk 0,938, azınlık duyarlılığı 0.
  - Kitabın `bolum11_kod02` sıralaması (ölçeksiz, 8 özellik): önce SMOTE (1876 / 1876), sonra
    katmansız 70/30 bölme → test 1126 satır, 529 pozitif (%47), bunların 505'i sentetik;
    sentetik test noktalarının %98'inin en az bir "ebeveyni" eğitimde. Sızıntılı PR-AUC 0,704,
    sızıntısız 0,179 (kitap 0,724 / 0,147). Tohum 0–3: sızıntılı 0,69–0,72, sızıntısız
    0,16–0,18.
  - `class_weight="balanced"` PR-AUC 0,173 (kitapla aynı); ağırlıksız model 0,190.
  - Ölçekleme + SMOTE + model, 5 katlı `StratifiedKFold` (`random_state=42`): katlar 0,181 /
    0,190 / 0,125 / 0,234 / 0,191, ortalama 0,184 (kitap 0,177).
  - İki özellik (kıdem, aylık ücret; eğitimden standartlaştırılmış), lojistik regresyon (C = 1):
    ağırlıksız model testte hiç "ayrılır" demiyor ([[563, 0], [37, 0]]); SMOTE ile 25 / 37
    yakalanıyor, 198 yanlış alarm; sınıf ağırlığıyla 25 / 37, 205 yanlış alarm. Üçünün test
    PR-AUC'si de 0,205: dengeleme sıralamayı değil eşiği kaydırıyor.
  - Kitabın kodundaki `LogisticRegression(max_iter=1000)` ölçeksiz veride yakınsamıyor
    (lbfgs uyarısı); sonuçlar yine deterministik.

## Amaç ve kabul ölçütleri

Öğrenci dört şeyi kavramalı:

1. **Doğruluk dengesiz veride yalan söyler.** %6'lık azınlıkta "herkes kalır" diyen model %93,8
   doğruluk alır, ama tek bir ayrılanı yakalamaz. Azınlığın duyarlılığı, kesinliği ve PR-AUC'si
   birlikte okunur.
2. **SMOTE ve sınıf ağırlığı ne yapar?** SMOTE azınlık noktalarının arasına, komşu ile arasındaki
   doğru parçası üzerinde yeni noktalar koyar (x_new = x_i + λ·(x_zi − x_i)); kopyalama aynı
   noktayı yığar. Sınıf ağırlığı satır eklemez, azınlığın hatasını pahalı yapar. İkisi de karar
   sınırını kaydırır; sıralamayı (PR-AUC'yi) çoğu zaman pek değiştirmez.
3. **SMOTE bölmeden önce yapılırsa sonuç sahtedir.** Sentetik test noktalarının ebeveynleri
   eğitimdedir, testin pozitif oranı %6'dan %47'ye çıkar; PR-AUC 0,70'e fırlar. Doğru sıra: önce
   böl, SMOTE yalnız eğitimde; çapraz doğrulamada her katın eğitim parçasında (`imblearn`
   Pipeline).
4. **PR-AUC'nin tabanı pozitif orandır.** Rastgele sıralamanın PR-AUC'si pozitif oran kadardır;
   iki deneyin PR-AUC'si ancak aynı test dağılımında karşılaştırılır. Eşik ayrıca maliyetle
   seçilir.

Kabul ölçütleri:

1. İki yeni sayfa yayında: `dengesiz-veri/` ("Dengesiz veri: doğruluk tuzağı, SMOTE ve sınıf
   ağırlığı", 10 adım) ve `smote-sizinti/` ("SMOTE sızıntısı ve PR-AUC", 10 adım); ikisi de Ders
   ve Laboratuvar modunda çalışır. Ana sayfada Bölüm 11'in iki kartı "hazır" olur: 28 kavram,
   26 hazır, 2 yakında.
2. Ekrandaki her model sayısı (karışıklık matrisleri, duyarlılık, kesinlik, PR-AUC, katsayılar,
   sayımlar) üreticinin scikit-learn ile yazdığı veriden gelir ya da tarayıcıda o veriden
   hesaplanır ve birim testinde üreticinin fixture'ıyla doğrulanır. Kitabın tutan sayıları
   (563 / 0 / 37 / 0 matrisi, 1313 / 87 sayımı, 0,173) üreticide denetlenir; tutmazsa üretici
   durur.
3. Her hesap sayılarıyla da yazılır ("x_new = 12 + 0,37 · (20 − 12) = 15,0 ay",
   "8,05 = 1400 / (2 · 87)").
4. 1280×720'de Ders ve Lab adımlarında yazı yazının üstüne binmez, hiçbir şey kırpılmaz;
   900 px altında tek sütun, 390 px'te yatay taşma yok ve sahne oynatıcı çubuğunun altında
   kalmaz (`dar-ekran.spec.ts` hazır sayfaları kayıt defterinden otomatik kapsar).
5. `npm run check` yeşil; kontrolcü ekran görüntülerine kendisi bakar.

## Kararlar

| Konu | Karar | Kimin |
|---|---|---|
| Sayfa sayısı | İki sayfa: dengesizlik ve dengeleme yöntemleri (sayfa 1); SMOTE sızıntısı, PR-AUC tabanı, Pipeline, eşik (sayfa 2) | Benim kararım (Bölüm 7–10'un iki sayfa kalıbı) |
| Kimlikler | `dengesiz-veri` ve `smote-sizinti`; kayıttaki `soon('smote', 11, 'SMOTE')` iki hazır kayıtla değişir | Benim kararım |
| Veri | Kitabın `telco_churn_synthetic_severe.csv` dosyası değiştirilmeden `scripts/data/` altına kopyalanır; üretici oradan okur | Benim kararım: üretici kitap deposuna bağlı kalmaz |
| SMOTE | Kendi SMOTE'umuz (yukarıdaki algoritma, `imblearn`'ünkiyle aynı adımlar), mulberry32 üreteciyle; Python ve TS'de aynı | Benim kararım: `imblearn` kurulu değil; Lab tarayıcıda canlı üretir |
| Sayfa 1 sahnesi | İki özellik: kıdem (ay) × aylık ücret; SMOTE ve modeller eğitimden standartlaştırılmış bu iki özellikte; ekranda "iki özellikli model" | Benim kararım: SMOTE geometrisi ve karar sınırı ancak 2 boyutta görünür |
| Sayfa 1 modeli | L2 cezalı lojistik regresyon (C = 1, sklearn tanımı), örnek ağırlıklı; TS'de Newton yöntemiyle; fixture'da sklearn katsayılarıyla 1e-6 içinde | Benim kararım: Lab k / oran / ağırlık değişince sınırı canlı kurar |
| Sayfa 2 deneyleri | Kitabın kodları aynen (8 özellik, kod02 ölçeksiz, kod03/kod05 ölçekli Pipeline, kod04 ağırlıklı); hepsi üreticide; tarayıcı yalnız skorlardan eğri, eşik ve sayım hesaplar | Kitap |
| Kitapla farklar | Sızıntılı/sızıntısız ve CV sayıları SMOTE üretecinden ötürü birkaç yüzde farklı; sayfada bizim sayılarımız, "Kitapla farklar"da kitabınkiler | Benim kararım |
| mulberry32 | Üçüncü kullanım: `src/core/random.ts`'e taşınır; `topluluk/math.ts` ve `boosting/search.ts` oradan alır (davranış aynı, testleri değişmez) | AGENTS.md ortak parça kuralı |
| PR hesabı | `src/concepts/degerlendirme/curves.ts` (`curvePoints`, `averagePrecision`, `classify`) yeniden kullanılır | Benim kararım |
| Görünüm | Kalan gri-lacivert ●, ayrılan turuncu ●, sentetik turuncu ○ (içi boş, ince), kopya yığını sayı rozetiyle; eğitim noktaları dolu, test noktaları soluk; karar sınırı kesikli çizgi (yöntem başına bir çizgi biçimi + uçta etiket) | Benim kararım |

## Kapsam dışı

- ADASYN, Borderline-SMOTE, SMOTENC, Tomek/ENN temizleme (yalnız kitabın alternatifler
  tablosunda birer satır), `RandomUnderSampler` deneyi (bir cümle).
- Hedef sızıntısı, zaman ve grup sızıntısının sayısal deneyi (sayfa 2 adım 10'da yalnız
  kartlarla).
- Maliyet duyarlı eşik seçiminin ayrıntısı (Bölüm 6 `roc-esik/`'e bağlantı).
- Kalibrasyon (SMOTE'un olasılıkları şişirmesi bir cümleyle anılır).
- Tarayıcıda 8 özellikli model eğitimi; kitabın düzeltilmesi (çıktı yalnızca "Kitapla
  farklar").

## Ortak öğretim dili ve görünüm

Bölüm 9–10 kuralları aynen: metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox
yok; sayılar Türkçe ondalık virgülüyle (PR-AUC, kesinlik, duyarlılık 3 ondalık; doğruluk yüzde
1 ondalık; ağırlıklar 2 ondalık); hesaplanan sayıdan sonra kesme işaretli ek yok ("87 ayrılan",
"5 komşu"); tarama bitince taranan değer son değerinde kalır; `prefers-reduced-motion` altında
son durum anında çizilir; adım kartı Lab'de `labText` gösterir; etkileşimli sahne öğeleri yalnız
Lab'de.

- Sahneler `src/core/plot/` parçalarını kullanır (`AxesLayer`, `LineChartLayer` (PR eğrileri),
  `HBarsLayer` (sınıf sayımları), formül şeridi, etiket yerleştirici, biçimlendirme,
  geçişler). Bölüm 6'nın karışıklık matrisi çizimi uygunsa çekirdeğe taşınır; değilse küçük
  2×2 matris iki sayfanın ortak parçası olarak `src/concepts/dengesiz/`'de durur.
- İki sayfanın ortak verisi ve hesabı `src/concepts/dengesiz/` altında (Bölüm 10'daki
  `boosting/` kalıbı).
- Sınıf adları ekranda: "kalan" ve "ayrılan" (churn = ayrılan). Özellikler: "kıdem (ay)",
  "aylık ücret".

## Ortak veri ve hesap (`src/concepts/dengesiz/`)

- `data/dengesiz.json` (yalnız üretici yazar):
  - **müşteriler:** 2000 satır: kıdem, aylık ücret, sınıf, katmanlı bölmedeki yeri (eğitim /
    test); iki özelliğin eğitim ortalaması ve standart sapması (`StandardScaler`, ddof = 0);
  - **kitap modeli (kod01):** test karışıklık matrisi ve azınlık satırı (kesinlik, duyarlılık,
    F1);
  - **iki özellikli modeller:** ağırlıksız, SMOTE (k = 5, tohum 42, oran 1,0), dengeli ağırlık:
    katsayılar, kesişim, test karışıklık matrisi, test PR-AUC (TS'in yeniden hesapladığını
    denetlemek için);
  - **sızıntı deneyi (kod02, tohum 42 ve 0–4):** sızıntılı yol: test satır sayısı, pozitif,
    sentetik pozitif, ebeveyni eğitimde olan sentetik sayısı, test skorları ve etiketleri (PR
    eğrisi için), PR-AUC; ayrıca adım 3'ün örnek sentetik noktası (iki özellikteki izdüşümü ve
    iki ebeveyni); sızıntısız yol: test skorları, PR-AUC;
  - **Pipeline CV (kod03):** 5 katın PR-AUC'si ve ortalaması; her katın eğitim / doğrulama
    sayımları ve SMOTE sonrası eğitim sayımı;
  - **karşılaştırma (kod04, kod05):** aynı test bölmesinde ağırlıksız, SMOTE Pipeline ve
    ağırlıklı modelin test skorları (600 satır) ve PR-AUC'leri; kod05'in 0,5 eşiğindeki
    raporu;
  - **hata ayıklama kodu:** kitabın `ChurnDebug` kodu satırları ve 5 hata (satır numarası,
    tür, açıklama) — metin üreticide değil `scenario.ts`'de durur (veri değil).
- Saf TS fonksiyonları:
  - `smote(points, k, nNew, seed)` → `{ x, y, i, j, lambda }[]`: azınlık noktaları üzerinde;
    komşular kare Öklid uzaklığına göre (eşitlikte küçük dizin), kendisi hariç; her yeni nokta
    için sırayla `i = ⌊r()·n⌋`, `j = komşu[i][⌊r()·k⌋]`, `λ = r()`. Python eşi aynı.
  - `randomOversample(n, nNew, seed)` → her azınlık noktasının kopya sayısı.
  - `fitLogReg(X, y, w, C)` → `{ coef, intercept }`: sklearn'ün amacı
    ½‖w‖² + C·Σ wᵢ·logloss; kesişim cezasız; Newton (Hessian 3×3), adım küçük olunca durur.
  - `balancedWeights(y)` → n / (2·n_c).
  - PR eğrisi ve PR-AUC: `degerlendirme/curves.ts`.
- Birim testleri: `smote` üreticideki Python eşiyle (tohum 42 ve 7, k ∈ {1, 5}) birebir aynı
  i, j, λ dizisini ve noktaları (1e-12) verir; `fitLogReg` fixture'daki sklearn katsayılarıyla
  (`tol=1e-10`) 1e-6 içinde (ağırlıksız, SMOTE'lu, dengeli ağırlıklı); bu katsayılarla testin
  karışıklık matrisi ve PR-AUC'si fixture'la aynı; `averagePrecision` sızıntı deneyinin
  skorlarında üreticinin `average_precision_score`'uyla 1e-9 içinde.
- Üretici: `scripts/make_dengesiz_data.py` (`--check` ile kayma denetimi; diğer üreticilerin
  kalıbı; iki kez çalışınca bayt bayt aynı). Denetimler: 2000 / 124 satır; eğitim 1313 / 87;
  kod01 matrisi [[563, 0], [37, 0]]; kod04 PR-AUC 0,173 (3 ondalık); sızıntılı PR-AUC > 0,5 ve
  sızıntısızın en az 3 katı; iki özellikli ağırlıksız model testte hiç pozitif demiyor; tutmazsa
  durur ve raporlar. Fixture: `tests/fixtures/dengesiz_sklearn.json`.

## Sayfa 1 — Dengesiz veri: doğruluk tuzağı, SMOTE ve sınıf ağırlığı (`dengesiz-veri/`)

### Öğrenme sonucu

Öğrenci %94 doğruluğun bir ayrılanı bile yakalamadığını matristen okur; SMOTE'un bir sentetik
noktayı nasıl kurduğunu sayılarıyla izler; SMOTE ile kopyalamanın, SMOTE ile sınıf ağırlığının
farkını görür; üç modelin karar sınırını aynı düzlemde karşılaştırır ve dengelemenin sınırı
kaydırdığını ama sıralamayı (PR-AUC) değiştirmediğini fark eder.

### Görünüm

Ana alan **saçılım**: x kıdem (ay, 0–72), y aylık ücret (18–120); kalan gri-lacivert, ayrılan
turuncu, sentetik turuncu içi boş. Yanında ya da altında **yan panel**: sınıf sayım çubukları
(`HBarsLayer`), adım 2–3 ve 9–10'da 2×2 karışıklık matrisi ve metrik satırı, adım 10'da üç
satırlı karşılaştırma tablosu. Altta formül şeridi. Adım 7'de saçılım iki küçük panele bölünür
(kopyalama | SMOTE).

### Adımlar (Ders)

1. **Veri.** 2000 müşteri, 124 ayrılan (%6,2); saçılım ve sayım çubukları (1876 | 124). "Ayrılanlar
   kısa kıdemli ve yüksek ücretli köşede biraz daha sık, ama kalanların arasına karışmış."
2. **Doğruluk tuzağı.** Test 600 müşteri; kitabın modeli (bütün özellikler) kimseye "ayrılır"
   demiyor: matris [[563, 0], [37, 0]], doğruluk %93,8. "Herkese 'kalır' demek de %93,8 verir."
   Altında kitabın satırı `LogisticRegression(max_iter=1000)`.
3. **Azınlığın gözüyle.** Ayrılan sınıfı: duyarlılık 0 / 37 = 0, kesinlik tanımsız (0 / 0), F1 0;
   kitabın `classification_report` satırı. "Doğruluk azınlığı gizler; ayrılanların metriği
   ayrıca okunur."
4. **Eğitim kümesi.** Katmanlı 70/30 bölme: eğitim 1313 kalan / 87 ayrılan (yaklaşık 15:1);
   test noktaları soluklaşır. "Test kenara ayrıldı; dengeleme yalnız eğitimde yapılacak."
5. **Bir sentetik nokta.** Bir ayrılan x_i vurgulanır; 5 en yakın ayrılan komşusuna ince
   çizgiler; biri (x_zi) seçilir; λ (veriden) ile x_new aradaki doğru parçasının üstünde belirir.
   Formül şeridi: x_new = x_i + λ·(x_zi − x_i), iki özellik için sayılarla (ekranda özgün
   birimlerde).
6. **SMOTE eğitimi doldurur.** Tarama 0 → 1226 sentetik nokta; sayım 87 → 1313 (1313 | 1313).
   "Hiçbir satır kopyalanmadı; noktalar ayrılanların arasına serpildi."
7. **Kopyalamadan farkı.** İki küçük panel: rastgele kopyalama (aynı 87 nokta, üstlerinde
   kopya sayısı rozeti; en çok kopyalanan ×N, veriden) ve SMOTE. "Kopya modeli aynı noktaları
   ezberlemeye iter; SMOTE aradaki bölgeyi doldurur. Ama sentetik nokta yeni müşteri değildir."
8. **Sınıf ağırlığı.** Satır eklenmez; ayrılan noktalar ağırlıklarıyla büyür: 8,05 = 1400 /
   (2 · 87), kalan 0,53 = 1400 / (2 · 1313). Kitabın satırı `class_weight="balanced"`. "Bir
   ayrılanı kaçırmak, 15 kalanı yanlış alarmlamak kadar pahalı."
9. **Karar sınırı.** İki özellikli üç model, p = 0,5 sınırı: ağırlıksız (görünür alanın dışında
   kalırsa kenarda "sınır alan dışında: kimse ayrılır denmiyor"), SMOTE ve ağırlıklı (iki yakın
   kesikli çizgi). Test matrisleri: 0 / 37, 25 / 37 (198 yanlış alarm), 25 / 37 (205 yanlış
   alarm) (veriden).
10. **Ne değişti?** Üç satırlı tablo: yöntem, yakalanan, yanlış alarm, kesinlik, duyarlılık,
    PR-AUC. PR-AUC üçünde de aynı (0,205, veriden). "Dengeleme sıralamayı değil eşiği kaydırdı:
    aynı şeyi eşiği düşürerek de elde edebilirdik." Ders sonu bağlantıları: SMOTE sızıntısı
    sayfasına ve Bölüm 6 `roc-esik/` sayfasına.

(Sayılar ön denemenin değerleridir; ekrandaki her sayı üreticiden ya da fixture'la doğrulanan
TS hesabından okunur.)

### Laboratuvar

- **Adım 1–4:** "test noktalarını göster" anahtarı.
- **Adım 5:** k kaydırıcısı 1–10 ve "başka nokta" düğmesi (tohum); komşu çizgileri, λ ve
  formül canlı.
- **Adım 6–7:** k 1–10, oran kaydırıcısı (azınlık / çoğunluk hedefi 0,1–1,0) ve tohum; sentetik
  sayısı ve noktalar canlı (TS `smote`, `randomOversample`).
- **Adım 8:** ağırlık seçimi: yok / dengeli / elle (ayrılan ağırlığı 1–30).
- **Adım 9–10:** yöntem seçimi (yok / SMOTE / ağırlık), k, oran, elle ağırlık, eşik kaydırıcısı
  0,05–0,95; tarayıcı modeli yeniden kurar (`fitLogReg`); sınır çizgisi, test matrisi,
  kesinlik, duyarlılık ve PR-AUC canlı. Adım 10'da seçilen yapılandırma tabloya dördüncü satır
  olarak eklenir.
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Sayfa 2 — SMOTE sızıntısı ve PR-AUC (`smote-sizinti/`)

### Öğrenme sonucu

Öğrenci SMOTE'u bölmeden önce yapmanın testi nasıl değiştirdiğini sayımlardan ve sentetik
noktaların ebeveynlerinden görür; PR-AUC'nin tabanının pozitif oran olduğunu iki eğrinin
kesikli taban çizgilerinden okur; sızıntılı 0,70 ile sızıntısız 0,18'in farkının modelden değil
deneyden geldiğini; Pipeline'ın SMOTE'u her katın eğitim parçasına nasıl hapsettiğini; SMOTE ile
sınıf ağırlığının bu veride benzer sonuç verdiğini; eşiğin ayrı bir karar olduğunu; kitabın hata
ayıklama kodundaki beş hatayı görür.

### Görünüm

Adım 1–2'de **akış şeridi**: iki satır kutu-ok dizisi (yanlış: veri → SMOTE → böl → eğit →
test; doğru: veri → böl → [SMOTE → eğit] → test) ve altında sayım çubukları. Adım 3'te
**saçılım** (iki özellikli izdüşüm): bir sentetik test noktası ve iki ebeveyni, aradaki doğru
parçası. Adım 4–5, 7–8'de **PR sahnesi** (`LineChartLayer`): x duyarlılık, y kesinlik, her eğrinin
kesikli taban çizgisi ve uçta etiketi. Adım 6'da **kat şeridi**: 5 satır, her satırda eğitim
parçası (SMOTE'lu) ve doğrulama parçası, sağda kat PR-AUC'si. Adım 9'da **kod paneli**: kitabın
hatalı kodu, satır numaralı; hatalı satırlar sırayla işaretlenir. Adım 10'da **kartlar**.

### Adımlar (Ders)

1. **İki sıra.** Akış şeridi; yanlış sıra turuncu, doğru sıra lacivert. Kitabın kuralı: "önce
   eğitim/test ayrımı yapılır; SMOTE yalnızca eğitim verisine uygulanır."
2. **Önce SMOTE.** Bütün veri 1876 / 124 → 1876 / 1876 (1752 sentetik); sonra katmansız 70/30:
   test 1126 satır, 529 ayrılan, bunların 505'i sentetik (veriden). Test çubuğunda gerçek ve
   sentetik ayrı tonda.
3. **Testte ne var?** Bir sentetik test noktası ve iki ebeveyni (ikisi de eğitimde) saçılımda;
   "sentetik test noktalarının %98'inin en az bir ebeveyni eğitimde" (veriden). "Model sınavda,
   ezberlediği noktaların arasını görüyor."
4. **PR-AUC'nin tabanı.** İki PR eğrisi: sızıntılı test ve sızıntısız test; kesikli taban
   çizgileri 0,470 ve 0,062 (pozitif oranlar). "Rastgele sıralama bile 0,47 alırdı."
5. **İki skor.** Sızıntılı 0,704, sızıntısız 0,179 (veriden; kitap 0,724 / 0,147). "Fark
   modelin değil, deneyin."
6. **Pipeline ve çapraz doğrulama.** 5 katlı katmanlı CV; her katta SMOTE yalnız eğitim
   parçasına (yaklaşık 1500 / 99 → 1500 / 1500), doğrulama parçası dokunulmaz; kat PR-AUC'leri
   sırayla belirir, ortalama 0,184 (veriden; kitap 0,177). Kitabın satırı
   `Pipeline(steps=[("olcekleme", …), ("smote", …), ("model", …)])` ve "`imblearn` Pipeline'ı
   örnekleyiciyi yalnız `fit` sırasında çalıştırır."
7. **SMOTE mı, sınıf ağırlığı mı?** Aynı test bölmesinde üç PR eğrisi: ağırlıksız 0,190, SMOTE
   0,179, ağırlıklı 0,173 (veriden). "Bu veride dengeleme PR-AUC'yi artırmadı; seçim veri
   miktarına ve maliyete bağlı." Kitabın "Sık yanlış anlama" kutusu.
8. **Eşik.** SMOTE Pipeline (kod05) 0,5 eşiğinde: 27 / 37 yakalandı, kesinlik 0,129 (veriden);
   PR eğrisinde nokta. Ağırlıksız modelin aynı duyarlılığa ulaştığı eşik ve oradaki kesinlik
   (veriden). "Dengesiz veride eşik de bir ayardır; maliyetle seçilir." Bölüm 6 `roc-esik/`
   bağlantısı.
9. **Hata ayıklama.** Kitabın `ChurnDebug` kodu; beş hata sırayla işaretlenir: SMOTE bölmeden
   önce; model test verisinde eğitiliyor; yalnız doğruluk; `random_state` yok; `stratify` yok.
   Sonra düzeltilmiş kodun dört satırı.
10. **Başka sızıntılar.** Üç kart: hedef sızıntısı ("iptal sonrası son fatura"), zaman ("şubat
    verisiyle ocağı tahmin etme" → `TimeSeriesSplit`), grup ("aynı müşterinin ayları iki
    kümede" → `GroupKFold`). Kitabın sınav notu: "Ölçekleyici, kodlayıcı, seçici ve SMOTE
    parametrelerini yalnızca eğitim verisinden öğrenmelidir." Ders sonu bağlantıları: dengesiz
    veri sayfasına ve Bölüm 6 `capraz-dogrulama/` sayfasına.

(Sayılar ön denemenin değerleridir; ekrandaki her sayı üreticiden okunur.)

### Laboratuvar

- **Adım 1–5:** sıra seçimi (yanlış / doğru) ve SMOTE tohumu (42, 0–4; üreticide hesaplı);
  sayımlar, sentetik örnek, eğriler ve skorlar seçime göre.
- **Adım 6:** "katı göster" seçimi (1–5): o katın sayımları vurgulanır.
- **Adım 7:** üç eğrinin görünürlük anahtarları.
- **Adım 8:** eşik kaydırıcısı 0,01–0,99 ve model seçimi (ağırlıksız / SMOTE / ağırlıklı);
  matris, kesinlik, duyarlılık ve eğri üstündeki nokta canlı (`classify` skorlar üzerinde).
- **Adım 9:** "düzeltilmiş kodu göster" anahtarı.
- **Adım 10:** kontrol yok.
- Adıma göre yalnızca o adımın kontrolleri görünür.

## Kitapla farklar (kitap düzeltmesi için liste)

- Kitap `imblearn`'ün SMOTE'unu kullanır; sayfa aynı algoritmayı kendi üreteciyle çalıştırır.
  Sızıntılı / sızıntısız PR-AUC 0,724 / 0,147 yerine 0,704 / 0,179; CV ortalaması 0,177 yerine
  0,184. Örüntü aynı.
- Kitabın `bolum11_kod02` ve `kod04`'ündeki `LogisticRegression(max_iter=1000)` ölçeksiz veride
  yakınsamıyor (lbfgs uyarısı); kod03 ve kod05 ölçekli.
- Kitabın Şekil 11.1 açıklaması (1313 / 87 → 1313 / 1313) doğru; sayfa aynı sayıları kullanır.

## Arayüzler

- Her sayfa mevcut `ConceptPage<Params>` sözleşmesini sağlar; `StepPlayer` adım/tarama
  sözleşmesi değişmez; adım indeksleri `stepIndex` ile adım kimliklerinden türetilir; Lab metni
  `Step.labText`.
- Kimlikler ve yollar: `dengesiz-veri` → `dengesiz-veri/`, başlık "Dengesiz veri: doğruluk
  tuzağı, SMOTE ve sınıf ağırlığı"; `smote-sizinti` → `smote-sizinti/`, başlık "SMOTE sızıntısı
  ve PR-AUC". Kayıt defterinde `soon('smote', 11, 'SMOTE')` iki hazır kayıtla değişir.
- Çekirdek: `src/core/random.ts` → `mulberry32(seed): () => number`.
- Parametre adları (öneri, yapıcıya bırakılır): sayfa 1 `{ showTest: boolean; k: number; seed:
  number; ratio: number; weight: 'yok' | 'dengeli' | 'elle'; manualWeight: number; method:
  'yok' | 'smote' | 'agirlik'; threshold: number }`; sayfa 2 `{ order: 'yanlis' | 'dogru'; seed:
  number; fold: number; show: { base: boolean; smote: boolean; weighted: boolean }; model:
  'base' | 'smote' | 'weighted'; threshold: number; fixed: boolean }`.

## Hata durumları

- k azınlık nokta sayısından büyükse k = n − 1 kullanılır ve yazılır.
- Kesinlik 0 / 0 ise "tanımsız" yazılır (Bölüm 6'nın `UNDEFINED_TEXT` kalıbı); F1 o durumda 0.
- Karar sınırı görünür alanı kesmiyorsa çizgi çizilmez, kenarda "sınır alan dışında" notu.
- Newton yakınsamazsa (50 adım) son katsayılar kullanılır ve geliştirici konsoluna uyarı
  yazılır; testte bu duruma düşülmediği denetlenir.
- Hiçbir durumda NaN / Infinity ekrana basılmaz.

## Doğrulama

- Birim: ortak hesap fixture'a karşı (yukarıda); senaryo adım kimlikleri, parametreleri ve
  metinlerdeki sayıların veriden geldiği; sahne testleri (her adımın anahtar DOM öğesi:
  saçılım noktaları ve sınıfları, sayım çubukları, karışıklık matrisi hücreleri, komşu
  çizgileri ve x_new, formül şeridi, sentetik noktalar, kopya rozetleri, ağırlıklı nokta
  boyutları, karar sınırı çizgileri ve "alan dışında" notu, karşılaştırma tablosu; akış şeridi
  kutuları, test çubuğunun gerçek/sentetik bölümleri, ebeveyn çizgileri, PR eğrileri ve taban
  çizgileri, kat satırları, eşik noktası, kod paneli işaretleri, kartlar).
- e2e (yalın): her sayfa için Ders anahtar adımları (sayfa 1: 2, 5, 9, 10; sayfa 2: 2, 4, 6, 9)
  ve birer Lab etkileşimi (k + oran kaydır, yöntem değiştir; eşik kaydır) ekran görüntüsü
  temeliyle; etiket çakışması ve sahne dışına taşma kontrolleri.
- Performans: sayfa 1 adım 9 oran sürükleme (SMOTE + Newton yeniden) ve sayfa 2 adım 8 eşik
  sürükleme p95 ≤ 25 ms (bölüm sonunda bir kez).
- Kapanış: `npm run check` çıkış 0; kontrolcü ekran görüntülerine kendisi bakar.

## Yapıcıya bırakılanlar

- Dosya bölünmesi, parametre adları, panel oranları, nokta boyutları ve ağırlığın boyuta
  çevrilmesi, kopya rozetinin eşiği, akış şeridi ve kat şeridinin çizimi, tarama hızları, adım
  5'in örnek noktasının seçimi (veriden, okunaklı bir yerde), kod panelinin yazı tipi.
