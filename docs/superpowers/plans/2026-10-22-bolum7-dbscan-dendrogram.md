# Bölüm 7 DBSCAN ve Dendrogram Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İki yeni Ders/Laboratuvar sayfası — `dbscan/` (DBSCAN, 10 adım) ve `dendrogram/`
(Hiyerarşik kümeleme ve dendrogram, 10 adım) — ile Bölüm 7'yi tamamlamak; ana sayfa 22 kavram,
14 hazır, 8 yakında.

**Architecture:** İki deterministik Python üreticisi (sklearn / scipy) veriyi ve referansları
JSON'a yazar. DBSCAN tarayıcıda saf bir fonksiyonla hesaplanır (Lab kaydırıcıları canlı) ve
sklearn fixture ızgarasına karşı birebir test edilir; dendrogram scipy `linkage` çıktısından
çizilir. Her sayfa `ConceptPage<P>` + `StepPlayer` sözleşmesiyle kendi senaryo, görünüm, sahne ve
kontrollerini taşır; saçılım için `src/core/plot/` parçaları (eksenler, `fitEqualAspect`,
etiket yerleştirme, `CLUSTER` paleti) kullanılır.

**Tech Stack:** TypeScript, D3 (mevcut), Python/numpy/scikit-learn/scipy (`scripts/requirements.txt`,
yeni bağımlılık yok), Vitest/jsdom, Playwright/system Chrome.

**Spec:** `docs/superpowers/specs/2026-10-22-bolum7-dbscan-dendrogram-design.md` — adım listeleri,
veri kararları ve "Yapıcı kontrolünden çıkan kararlar" bağlayıcıdır; plan onları tekrar etmez,
görevler spec'e atıf yapar.

## Global Constraints

- Off-limits: `C:\projects\ModernVeriMadenGiris` salt okunur; 5180 portundaki dev sunucusuna
  dokunulmaz (e2e kendi `vite preview`'ini 4173'te açar); `src/concepts/*/data/` elle
  düzenlenmez, yalnız `scripts/make_*_data.py` üretir.
- Her commit öncesi `npx tsc --noEmit` ve `npm test`; commit sonu
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; LF satır sonları; Windows 11 Git Bash.
- Odaklı testler: `npx vitest run tests/unit/<dosya>.test.ts`,
  `npx playwright test tests/e2e/<dosya>.spec.ts`. `npm run check` yalnızca kontrolcü çalıştırır.
- Ondalık ayırıcı virgül (`src/core/plot/format.ts`); tanımsız değer tam olarak `— (tanımsız)`;
  NaN / Infinity ekrana basılmaz.
- Metin boyutları yalnız `--fs-*` belirteçlerinden; SVG'lerde viewBox yok; saçılımlar eşit oranlı
  (`fitEqualAspect`); `prefers-reduced-motion` altında son durum anında.
- Tarama bitince taranan değer son değerinde kalır: taranan anahtar o adımın `params`'ına yazılmaz.
- Adım indeksleri `stepIndex(scenario, id)` ile (`src/core/player.ts`), sayı sabiti değil.
- Ekrandaki her sayı JSON'dan ya da test edilmiş tarayıcı hesabından gelir; testler JSON'a karşı
  yazılır, spec'teki "ön deneme" sayılarına değil.
- Renk tek bilgi taşıyıcı değil: DBSCAN çekirdek = dolu daire, sınır = içi boş halka, gürültü =
  gri ×; kümeler "Küme N" çipleriyle de yazılır.
- Lab'de adıma göre yalnızca o adımın kontrolleri görünür; params kartı 1280×720'de kaydırma
  çubuğu olmadan sığar.

## Review Focus

- Kaydırıcı eps'i bir nokta çifti uzaklığına tam denk getirirse tarayıcı sklearn'den ayrılmamalı
  (`d ≤ eps`, yuvarlanmış veri, ızgara güvenliği); Task 1 `matches sklearn on every grid pair` ve
  üretici kontrolü.
- Lab'de tarama sürerken eps / min_samples / bağlantı değişirse tarama durur, yeni değer anında
  ve tutarlı görünür; Task 4 `slider during spread sweep stops it`, Task 6 `linkage change during
  merge sweep stops it`.
- Lab'de parametre değişince panelin tür cümlesi yeni değerlere göre doğru kalmalı; Task 3
  `panel verdict follows live params`.
- Bağlantı değişince küme sayısı korunmalı, kesim yeni ağaçta o sayının aralığına yerleşmeli;
  Task 2 `cutForK centres the cut inside the k range` ve Task 6 `linkage change keeps k`.
- Tekrar mount / destroy zamanlayıcı ve dinleyici biriktirmemeli; Task 3 ve Task 5
  `destroy stops timers and removes listeners`.

---

## Dosya yapısı

- `scripts/make_dbscan_data.py` → `src/concepts/dbscan/data/dbscan.json`,
  `tests/fixtures/dbscan_sklearn.json`
- `scripts/make_dendrogram_data.py` → `src/concepts/dendrogram/data/dendrogram.json`
- `src/concepts/dbscan/`: `data.ts` (tipli JSON), `dbscan.ts` (saf algoritma), `scenario.ts`,
  `view.ts` (metin / sayı türetme), `scene.ts`, `controls.ts`, `dbscan.css`, `main.ts`
- `src/concepts/dendrogram/`: `data.ts`, `tree.ts` (geometri, kesim → etiket), `scenario.ts`,
  `view.ts`, `scene.ts`, `controls.ts`, `dendrogram.css`, `main.ts`
- `src/core/plot/point-kinds.ts` (Task 3): DBSCAN nokta türü katmanı — çekirdek / sınır / gürültü
  işaretleri, eps dairesi, komşu halkaları, seçili nokta etiketi. Saçılım çerçevesi için
  `src/concepts/kmeans/plot-frame.ts` `ClusterPlotFrame` yeniden kullanılır (alan ve eksen adları
  parametre olur, bkz. Task 3).
- `dbscan/index.html`, `dendrogram/index.html` (mevcut sayfaların kalıbı), `vite.config.ts` girişleri.

## Görev / adım / DOM / test tablosu (yalnız spec'in ana anları)

| Sayfa · adım | Ana an | DOM | Test |
|---|---|---|---|
| dbscan 3 | eps dairesi ve komşu sayısı | `circle.pk-eps`, `[data-neighbours]` | Task 3 `step 3 draws the eps circle of A with its neighbour count` |
| dbscan 4–6 | çekirdek / sınır / gürültü kararı | `[data-verdict=core|border|noise]` | Task 3 `steps 4-6 show core, border and noise verdicts` |
| dbscan 7 | bütün türler | `[data-kind]` sayıları, `[data-counts]` | Task 3 `step 7 counts match the data` |
| dbscan 8 | kümeler yayılır | `[data-spread]`, `[data-clusters]` | Task 3 `step 8 sweep ends with every cluster coloured` |
| dbscan 10 | k-uzaklık, bükülme ve 0,3 | `svg.kd-chart`, `[data-knee]`, `[data-eps-line]` | Task 3 `step 10 marks the knee and eps` |
| dendrogram 2 | ilk birleşme iki görünümde | `[data-merge="1"]` dal + saçılım kapsayıcısı | Task 5 `step 2 shows the first merge in both views` |
| dendrogram 6–8 | kesim, küme sayısı, doğal kesim | `line.dg-cut`, `[data-k]`, `[data-gap]` | Task 5 `step 8 puts the cut in the largest gap with k=3` |
| dendrogram 9 | single zincirleme | `[data-linkage=single]`, boylar | Task 5 `step 9 single linkage chains A and B` |

---

### Task 1: DBSCAN üreticisi, veri modülü ve tarayıcı algoritması

**Files:**
- Create: `scripts/make_dbscan_data.py`, `src/concepts/dbscan/data.ts`, `src/concepts/dbscan/dbscan.ts`
- Generated: `src/concepts/dbscan/data/dbscan.json`, `tests/fixtures/dbscan_sklearn.json`
- Test: `tests/unit/dbscan/data.test.ts`, `tests/unit/dbscan/dbscan.test.ts`

**Interfaces:**
- Produces (`src/concepts/dbscan/data.ts`):
  ```ts
  export type Pt = readonly [number, number];
  export interface DbscanData {
    readonly meta: { sklearn: string; moons: { n: number; noise: number; seed: number }; outliers: { n: number; seed: number }; eps: number; minSamples: number };
    readonly points: readonly Pt[];            // 6-decimal, scaled; moons first, outliers last
    readonly kmeansLabels: readonly number[];  // KMeans(2, n_init=10, random_state=42)
    readonly examples: { readonly core: number; readonly border: number; readonly noise: number };
    readonly kdist: readonly { readonly minSamples: number; readonly sorted: readonly number[] }[]; // minSamples 2..15
    readonly knee: number;                     // knee of the minSamples=5 curve (distance)
    readonly epsSweep: readonly [number, number, number]; // step 9 stops, e.g. [0.15, 0.3, 0.6]
  }
  export const dbscanData: DbscanData;
  ```
- Produces (`src/concepts/dbscan/dbscan.ts`):
  ```ts
  export type Kind = 'core' | 'border' | 'noise';
  export interface DbscanResult {
    readonly kind: readonly Kind[];
    readonly label: readonly number[];          // -1 noise; clusters 0.. in discovery order
    readonly neighbours: readonly (readonly number[])[]; // indices with d ≤ eps, self included
    readonly order: readonly number[];          // points in the order the expansion reached them
    readonly clusters: number;
  }
  export function dbscan(points: readonly Pt[], eps: number, minSamples: number): DbscanResult;
  ```

- [ ] **Step 1: Üretici.** `make_dbscan_data.py`, spec "DBSCAN verisi" ve kararlar 1, 2, 7'ye göre:
  `make_moons(200, noise=0.08, random_state=42)` + aykırı tohumundan 10 düzgün dağılımlı nokta
  (spec'teki kutu), `StandardScaler`, **önce 6 ondalığa yuvarla, sonra** bütün hesaplar.
  Ölçütler: eps=0,3 / min_samples=5'te 2 küme, sınır ≥ 5, gürültü ≥ 5 (tutmazsa aykırı tohumu
  7'den sırayla artar); ızgara güvenliği (eps ∈ {0,05; 0,06; …; 1,00} için her çift
  |d − eps| ≥ 1e-9); örnek noktalar (spec kuralı); `epsSweep` (küçük uçta gürültü ≥ %20, büyük
  uçta 1 küme; 0,3 ortada); k-uzaklık (min_samples 2..15, `NearestNeighbors(n_neighbors=m)`'nin
  m'inci uzaklığı, sıralı); bükülme (Kneedle: normalize eğride köşegenden en uzak nokta), |knee − 0,3|
  ≤ 0,1. Herhangi bir ölçüt tutmazsa `sys.exit(1)` ve hangi ölçüt olduğunu yazar.
  `--check` bayrağı: hiçbir şey yazmaz, sürüklenmede çıkış 1 (`make_kmeans_data.py` kalıbı;
  `json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)`).
  Fixture: eps ∈ {0,10; 0,15; …; 1,00} × min_samples ∈ {2, 3, 5, 8, 10, 15} için sklearn
  `core_sample_indices_`, `labels_` ve iki kümeye de ulaşabilen sınır noktaları
  (`ambiguousBorder: {index: [clusters]}`).
- [ ] **Step 2: Üreticiyi çalıştır.** `python scripts/make_dbscan_data.py` ardından
  `python scripts/make_dbscan_data.py --check` (çıkış 0). Seçilen tohum, sayılar ve knee
  raporunu task raporuna yaz.
- [ ] **Step 3: Başarısız testler.** `tests/unit/dbscan/dbscan.test.ts`:
  - `matches sklearn on every grid pair` — fixture'daki her çift: çekirdek kümesi birebir, gürültü
    kümesi birebir, kümeler etiket permütasyonuna kadar birebir; `ambiguousBorder` noktalarında
    listedeki her küme kabul.
  - `neighbours include the point itself and use d ≤ eps` — üç noktalı elle veri, uzaklık tam eps.
  - `no core points means every point is noise` — eps=0,01.
  - `minSamples 2 never yields a single-point cluster`.
  - `order lists each clustered point once, cores of a cluster before the next cluster`.
  `tests/unit/dbscan/data.test.ts`:
  - `points are 210 and 6-decimal` ; `examples have the kinds their names say at 0.3 / 5`
    (tarayıcı `dbscan` ile); `kdist curves are sorted and match a direct computation for
    minSamples 5`; `knee is within 0.1 of 0.3`; `epsSweep ends: noise ≥ 20 % at the small stop,
    one cluster at the large stop`.
- [ ] **Step 4: `dbscan()` ve `data.ts`'i yaz.** Komşuluk O(n²) uzaklık karesiyle (`d² ≤ eps²`
  ikisi de yuvarlanmış veriden; karşılaştırma sklearn ile aynı sonuç verir — test bunu kanıtlar);
  genişleme sklearn sırasıyla (indeks sırasında ziyaret edilmemiş çekirdekten başla, BFS).
- [ ] **Step 5: Testleri çalıştır.** `npx vitest run tests/unit/dbscan` → PASS.
- [ ] **Step 6: Commit.** `feat(dbscan): generator, data module and in-browser DBSCAN matching sklearn`

### Task 2: Dendrogram üreticisi, veri modülü ve ağaç geometrisi

**Files:**
- Create: `scripts/make_dendrogram_data.py`, `src/concepts/dendrogram/data.ts`, `src/concepts/dendrogram/tree.ts`
- Generated: `src/concepts/dendrogram/data/dendrogram.json`
- Test: `tests/unit/dendrogram/data.test.ts`, `tests/unit/dendrogram/tree.test.ts`

**Interfaces:**
- Produces (`src/concepts/dendrogram/data.ts`):
  ```ts
  export type Pt = readonly [number, number];
  export type Linkage = 'ward' | 'complete' | 'average' | 'single';
  export interface Merge { readonly a: number; readonly b: number; readonly height: number; readonly size: number } // scipy Z row; ids ≥ n are earlier merges
  export interface LinkageData {
    readonly merges: readonly Merge[];          // n-1 rows
    readonly leaves: readonly number[];         // scipy dendrogram leaf order
    readonly cuts: readonly { readonly k: number; readonly low: number; readonly high: number; readonly labels: readonly number[] }[]; // k=1..6; labels renumbered left-to-right by leaf order
  }
  export interface DendrogramData {
    readonly meta: { scipy: string; sklearn: string; groups: Readonly<Record<'A' | 'B' | 'C' | 'zincir', readonly number[]>> };
    readonly points: readonly Pt[];             // 17 points, 2 decimals
    readonly linkages: Readonly<Record<Linkage, LinkageData>>;
    readonly wardExample: { readonly merge: number; readonly increase: number }; // step 4: SSE increase of one merge
    readonly naturalK: number;                  // 3
  }
  export const dendrogramData: DendrogramData;
  ```
- Produces (`src/concepts/dendrogram/tree.ts`):
  ```ts
  export interface Branch { readonly id: number; readonly left: number; readonly right: number; readonly x: number; readonly xl: number; readonly xr: number; readonly yl: number; readonly yr: number; readonly height: number; readonly members: readonly number[] }
  export function leafX(ld: LinkageData): readonly number[];       // x slot of each point (0..n-1) by leaf order
  export function branches(ld: LinkageData, n: number): readonly Branch[]; // one per merge, in merge order
  export function labelsAtHeight(ld: LinkageData, n: number, t: number): readonly number[]; // merges with height ≤ t applied (scipy fcluster distance)
  export function kAtHeight(ld: LinkageData, t: number): number;
  export function cutForK(ld: LinkageData, k: number): number;     // midpoint of the k range
  export function largestGap(ld: LinkageData): { readonly k: number; readonly low: number; readonly high: number };
  export function clustersAfter(ld: LinkageData, n: number, merges: number): readonly (readonly number[])[]; // members after the first `merges` merges
  ```

- [ ] **Step 1: Üretici.** `make_dendrogram_data.py`, spec "Dendrogram verisi" ölçütleri 1–4:
  spec'teki 17 koordinat başlangıç; ölçüt tutmazsa zincir noktalarının y'sini 0,05 adımlarla
  sistematik oynat (kuralı betiğe yaz); yine tutmazsa `sys.exit(1)` + hangi ölçüt. Dört bağlantı
  için `linkage`, `dendrogram(no_plot=True)["leaves"]`, k=1..6 kesim aralıkları
  (`low = Z[n-k-1, 2]`, `high = Z[n-k, 2]`; k=1 için high = son yükseklik × 1,1) ve etiketler
  (`fcluster`), sklearn `AgglomerativeClustering` eşdeğerlik kontrolü (dört bağlantı, k=3),
  Ward örnek birleşmesi (adım 4: 4. birleşme) için SSE artışı. `--check` bayrağı (Task 1 kalıbı).
- [ ] **Step 2: Çalıştır.** `python scripts/make_dendrogram_data.py` ve `--check`. Son
  koordinatları ve dört bağlantının son beş yüksekliğini rapora yaz.
- [ ] **Step 3: Başarısız testler.** `tests/unit/dendrogram/tree.test.ts`:
  - `labelsAtHeight matches the stored cuts for k=1..6 in every linkage` (her `cuts[k]` için
    `(low+high)/2`'de, etiket permütasyonuna kadar).
  - `a cut exactly at a merge height counts that merge` (scipy kuralı).
  - `cutForK centres the cut inside the k range` ve `kAtHeight(cutForK(k)) === k`.
  - `largestGap of ward is k=3 and its groups are A, B, C` (meta.groups ile; zincir A ile B
    arasında bölünür).
  - `single linkage at k=3 puts A, chain and B together`.
  - `branches never cross: each branch x lies between its children` ;
    `clustersAfter(0) has n singletons and clustersAfter(n-1) one cluster`.
  `tests/unit/dendrogram/data.test.ts`: `17 points`, `heights strictly increase by ≥ 0.05 in every
  linkage`, `merge sizes add up`, `wardExample increase equals a direct SSE computation`.
- [ ] **Step 4: `tree.ts` ve `data.ts`'i yaz.**
- [ ] **Step 5: Testleri çalıştır.** `npx vitest run tests/unit/dendrogram` → PASS.
- [ ] **Step 6: Commit.** `feat(dendrogram): generator, data module and tree geometry`

### Task 3: `dbscan/` senaryo, görünüm ve sahne

**Files:**
- Create: `src/core/plot/point-kinds.ts`, `src/concepts/dbscan/{scenario,view,scene,main}.ts`, `src/concepts/dbscan/dbscan.css`, `dbscan/index.html`
- Modify: `src/concepts/kmeans/plot-frame.ts` (alan ve eksen adları parametre; varsayılanlar bugünkü değerler — K-Means sayfaları değişmez), `vite.config.ts` (`dbscan` girişi)
- Test: `tests/unit/dbscan/scenario.test.ts`, `tests/unit/dbscan/view.test.ts`, `tests/unit/dbscan/scene.test.ts`, `tests/unit/plot/point-kinds.test.ts`

**Interfaces:**
- Consumes: `dbscanData`, `dbscan()` (Task 1); `ClusterPlotFrame`; `stepIndex`.
- Produces:
  ```ts
  // scenario.ts
  export interface DbscanParams { eps: number; minSamples: number; point: number | null; spread: number } // spread: 0..1 share of `order` coloured (step 8)
  export const dbscanScenario: Scenario<DbscanParams>; // 10 steps, ids: 'hilaller','kmeans','eps','cekirdek','sinir','gurultu','turler','yayilma','eps-degisir','k-uzaklik'
  // view.ts
  export interface PointVerdict { index: number; neighbours: number; minSamples: number; kind: Kind; viaCore: number | null; text: string }
  export function verdictFor(r: DbscanResult, i: number, minSamples: number): PointVerdict;
  export function countsText(r: DbscanResult): string; // "2 küme · 191 çekirdek · 8 sınır · 11 gürültü"
  // core/plot/point-kinds.ts
  export interface PointKindsSpec { points: readonly Pt[]; kind: readonly Kind[] | null; label: readonly number[] | null; colouredUpTo?: number; order?: readonly number[]; eps?: { center: number; r: number } | null; neighbours?: readonly number[]; selected?: number | null }
  export class PointKindsLayer { constructor(parent: SVGGElement, domain: Domain); resize(r: Rect): void; update(s: PointKindsSpec, animate: boolean): void; destroy(): void }
  export function mountDbscanScene(host: HTMLElement, player: StepPlayer<DbscanParams>, mode: Mode): SceneHandle;
  ```
  (`Kind`, `Pt` core'da yeniden tanımlanır, `cluster-scatter.ts` kalıbı: core concepts'ten import etmez.)

- [ ] **Step 1: Başarısız testler.**
  - scenario: `has the 10 spec steps in order`, `steps 3-6 select A, A, B, C from the data`,
    `step 8 sweeps spread 0→1 and step 9 sweeps eps over epsSweep without writing the swept key`.
  - view: `verdict texts say the count, the comparison and the kind` (çekirdek "N ≥ 5 →
    çekirdek", sınır "N < 5, dairesinde çekirdek var (Nokta M) → sınır", gürültü "N < 5 ve
    dairesinde çekirdek yok → gürültü"; sayılar canlı); `panel verdict follows live params`
    (A'yı eps=0,1'de gürültü olarak anlatır).
  - point-kinds: `draws core as filled circle, border as ring, noise as grey cross`,
    `eps circle radius equals eps in pixels on both axes`, `neighbours get a thin navy ring`,
    `repeated update keeps element counts`.
  - scene (jsdom, reduced motion): her tablodaki dbscan satırı (step 3, 4–6, 7, 8, 10);
    `step 2 colours by kmeansLabels with no kinds`, `destroy stops timers and removes listeners`.
- [ ] **Step 2: Çalıştır, FAIL gör.**
- [ ] **Step 3: Uygula.** Yerleşim K-Means sayfalarının kalıbında: solda saçılım, sağda panel;
  Lab'de dar sahne için k-secimi'nin son yerleşimi (panel saçılımın altında) örnek alınır.
  Panel saçılım ölçülmeden önce çizilir (k-means/k-secimi I-1 kuralı). Adım 10'da panel yerine
  küçük k-uzaklık çizgi grafiği (`svg.kd-chart`; x: sıradaki nokta, y: uzaklık; bükülme ve eps
  çizgisi işaretli; altında `DBSCAN(eps=0.3, min_samples=5)` kod satırı). Adım 8 yayılması
  `order` sırasıyla `spread` oranında renklenir. Etiket yerleştirme `cluster-scatter.ts`'deki
  `placeLabels` mantığını kullanır (gerekirse küçük bir ortak yardımcıya çıkarılır, kopyalanmaz).
- [ ] **Step 4: Testler PASS; `npm test` ve `npx tsc --noEmit` temiz.**
- [ ] **Step 5: Ekran görüntüsü.** Geçici bir Playwright betiğiyle Ders adım 3, 5, 8, 10 ve
  Lab adım 6'yı 1280×720'de çek (scratchpad), Read ile bak: yazı yazının üstünde değil, kırpılma
  yok. Rapora yaz.
- [ ] **Step 6: Commit.** `feat(dbscan): scenario, view and scene`

### Task 4: `dbscan/` kontroller ve Laboratuvar

**Files:**
- Create: `src/concepts/dbscan/controls.ts`; Modify: `main.ts`, `scene.ts` (nokta tıklama), CSS
- Test: `tests/unit/dbscan/controls.test.ts`

**Interfaces:**
- Consumes: `DbscanParams`, `dbscanScenario`, `mountDbscanScene`.
- Produces: `export function mountDbscanParams(el: HTMLElement, player: StepPlayer<DbscanParams>): void;`

- [ ] **Step 1: Başarısız testler.** `eps slider 0.05..1.00 step 0.01 writes eps`,
  `min_samples slider 2..15`, `point input labelled 1–210 stores a 0-based index`,
  `clicking a point selects it` (scene), `controls shown per step` (spec Lab listesi: 1–2 yok;
  3–8 nokta + eps + min_samples; 9 eps; 10 min_samples), `slider during spread sweep stops it`.
- [ ] **Step 2–4: FAIL → uygula → PASS.** eps çıktısı virgüllü iki ondalık ("eps = 0,30").
- [ ] **Step 5: Ekran görüntüsü** Lab adım 4 ve 9'da, 1280×720; params kartı kaydırmasız sığar.
- [ ] **Step 6: Commit.** `feat(dbscan): lab controls`

### Task 5: `dendrogram/` senaryo, görünüm ve sahne

**Files:**
- Create: `src/concepts/dendrogram/{scenario,view,scene,main}.ts`, `src/concepts/dendrogram/dendrogram.css`, `src/core/plot/dendrogram.ts`, `dendrogram/index.html`
- Modify: `vite.config.ts` (`dendrogram` girişi)
- Test: `tests/unit/dendrogram/scenario.test.ts`, `tests/unit/dendrogram/view.test.ts`, `tests/unit/dendrogram/scene.test.ts`, `tests/unit/plot/dendrogram.test.ts`

**Interfaces:**
- Consumes: `dendrogramData`, `tree.ts` (Task 2); `ClusterPlotFrame` (Task 3'teki parametreli hâli), `CLUSTER`.
- Produces:
  ```ts
  // scenario.ts
  export interface DendrogramParams { linkage: Linkage; merges: number; k: number | null; point: number | null } // k null: no cut drawn
  export const dendrogramScenario: Scenario<DendrogramParams>; // 10 steps, ids: 'yapraklar','ilk-birlesme','birlesmeler','ward','agac','kesim','kesim-kayar','dogal-kesim','single','tablo'
  // core/plot/dendrogram.ts
  export interface DendrogramSpec { branches: readonly Branch[]; leafX: readonly number[]; leafLabels: readonly string[]; shown: number; highlight?: number | null; cut?: number | null; colourOf?: (pointIndex: number) => string; selectedLeaf?: number | null; gap?: { low: number; high: number } | null }
  export class DendrogramLayer { constructor(parent: SVGGElement); resize(r: Rect, maxHeight: number): void; update(s: DendrogramSpec, animate: boolean): void; destroy(): void }
  export function mountDendrogramScene(host: HTMLElement, player: StepPlayer<DendrogramParams>, mode: Mode): SceneHandle;
  ```
  (`Branch` core'da yapısal olarak yeniden tanımlanır; concepts'ten import yok.)

- [ ] **Step 1: Başarısız testler.**
  - scenario: `has the 10 spec steps in order`, `step 3 sweeps merges 2..8 and step 5 sweeps to
    16 without writing merges`, `step 7 sweeps k 1..6`, `step 8 uses naturalK`, `step 9 is single
    linkage with k=3`.
  - plot/dendrogram: `draws one ⊓ per shown merge at its height`, `cut line spans the plot at the
    cut height`, `branches above the cut are muted, clusters below take their colour`,
    `repeated update keeps element counts`.
  - view: `merge text names the two clusters and the height`, `k text and sizes follow the cut`,
    `step 10 table lists ward, complete, single sizes at k=3 from the data`.
  - scene: tablodaki dendrogram satırları (step 2, 6–8, 9);
    `step 4 shows the ward SSE increase from the data`; `destroy stops timers and removes listeners`.
- [ ] **Step 2: Çalıştır, FAIL gör.**
- [ ] **Step 3: Uygula.** Solda eşit oranlı saçılım (17 numaralı nokta; birleşen iki küme bir
  yuvarlatılmış kapsayıcıyla), sağda dendrogram (yapraklar altta nokta numaralarıyla, y ekseni
  "birleşme uzaklığı"), altta dar okuma paneli (spec "Görünüm"). Yükseklik ekseni bağlantının
  en büyük yüksekliğinden; adım 9'da Ward → single geçişi aynı görünümde animasyonlu (spec
  kararı 6). Panel saçılım ve dendrogram ölçülmeden önce çizilir.
- [ ] **Step 4: Testler PASS; `npm test`, `npx tsc --noEmit` temiz.**
- [ ] **Step 5: Ekran görüntüsü** Ders adım 2, 6, 8, 9, 10 ve Lab adım 7, 1280×720; Read ile bak.
- [ ] **Step 6: Commit.** `feat(dendrogram): scenario, view and scene`

### Task 6: `dendrogram/` kontroller ve Laboratuvar

**Files:**
- Create: `src/concepts/dendrogram/controls.ts`; Modify: `main.ts`, `scene.ts` (tıklama), CSS
- Test: `tests/unit/dendrogram/controls.test.ts`

**Interfaces:**
- Consumes: `DendrogramParams`, `cutForK`, `kAtHeight`, `mountDendrogramScene`.
- Produces: `export function mountDendrogramParams(el: HTMLElement, player: StepPlayer<DendrogramParams>): void;`

- [ ] **Step 1: Başarısız testler.** `linkage select offers ward, complete, average, single`,
  `merge buttons and slider 0..16`, `k buttons 1–6 set k`, `cut slider maps height to k via
  kAtHeight` (kaydırıcı aralığı bağlantının en büyük yüksekliğinden), `linkage change keeps k`,
  `controls shown per step` (1–5 birleşme + bağlantı; 6–8 kesim + bağlantı; 9–10 bağlantı +
  kesim), `clicking a point highlights its leaf; clicking a branch highlights its points`,
  `linkage change during merge sweep stops it`.
- [ ] **Step 2–4: FAIL → uygula → PASS.**
- [ ] **Step 5: Ekran görüntüsü** Lab adım 3 ve 9, 1280×720.
- [ ] **Step 6: Commit.** `feat(dendrogram): lab controls`

### Task 7: Entegrasyon, e2e, performans ve README

**Files:**
- Modify: `src/concepts/registry.ts` (`soon('dbscan', …)` ve `soon('dendrogram', …)` → hazır kayıtlar; başlıklar "DBSCAN", "Hiyerarşik kümeleme ve dendrogram"), `tests/unit/home.test.ts` (14 hazır, 8 yakında, kart numaraları), `tests/e2e/home.spec.ts` (gerekirse), `README.md` (iki canlı bağlantı; üretici satırları `make_dbscan_data.py`, `make_dendrogram_data.py`)
- Create: `tests/e2e/dbscan.spec.ts`, `tests/e2e/dendrogram.spec.ts`, `tests/e2e/dbscan.perf.spec.ts`, `tests/e2e/dendrogram.perf.spec.ts` + temeller

- [ ] **Step 1: Registry ve home testi.** `npx vitest run tests/unit/home.test.ts` → PASS.
- [ ] **Step 2: e2e.** Spec "Doğrulama": Ders anahtar adımları (DBSCAN 4, 5, 6, 8, 10;
  dendrogram 2, 6, 8, 9) ve birer Lab etkileşimi (eps kaydırıcısı + nokta tıklama; bağlantı
  değişimi + kesim) `toHaveScreenshot` ile; her ekran görüntüsünde `labelCollisions` ve
  `outsideStage` boş; tarama adımları tarama sonunu bekler (k-means adım 7 kalıbı);
  `narrow layout` testi 800×900 Ders ve Lab (saçılım ≥ 200 px yüksek, panel saçılımın altında,
  etiket çakışması yok).
- [ ] **Step 3: Temelleri al ve bak.** `--update-snapshots` ile; her PNG'yi Read ile aç.
- [ ] **Step 4: Performans.** DBSCAN Lab eps kaydırıcısı sürükleme ve dendrogram kesim
  sürükleme, p95 ≤ 25 ms (`k-secimi.perf.spec.ts` kalıbı). `npx playwright test
  tests/e2e/dbscan.perf.spec.ts tests/e2e/dendrogram.perf.spec.ts`.
- [ ] **Step 5: Commit.** `feat(bolum7): publish DBSCAN and dendrogram cards, e2e and README`
