# Veri Madenciliği Animasyonları — İskelet + k-NN Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, Turkish, GitHub Pages–hosted site with a reusable "concept page" skeleton (step player, parameter panel, Ders/Laboratuvar modes, keyboard control). Ship a home page and a fully animated k-NN page on Telco churn data from the book.

**Architecture:** This is a Vite multi-page TypeScript app.
- `src/core/` holds the concept-agnostic skeleton. Its main piece is `StepPlayer`, a step/parameter state machine in which steps can own parameter values. Around it sit the shell DOM, the modes, the keyboard handling and the theme.
- `src/concepts/knn/` holds the k-NN concept, split into three layers:
  - pure math: the algorithm, feature space and decision regions, checked against scikit-learn fixtures;
  - a pure view derivation;
  - a D3 SVG + Canvas renderer.
- A Python script samples the book's CSV once and writes two committed files: the embedded JSON data and the sklearn fixtures.

**Tech Stack:** Vite 7, TypeScript 5 (strict), d3-scale / d3-selection / d3-transition / d3-ease, Vitest + jsdom, Playwright (local e2e, system Chrome), Python 3 + pandas + scikit-learn (data/fixture generation only), GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-20-vm-animasyon-knn-design.md`

## Global Constraints

- **Language:** All UI text is Turkish. On first use, give the Turkish term with the English in parentheses, e.g. "tembel öğrenme (lazy learning)".
- **Colors:**
  - Navy `#14365C`: text and accents.
  - Orange `#F08A00`: Ayrıldı.
  - Teal `#0EA5A4`: Kaldı.
  - Background `#F6F9FC`.
  - Contrast must meet WCAG AA.
- **Class encoding:** Classes are always encoded by color + shape: Kaldı = teal ●, Ayrıldı = orange ▲, Yeni müşteri = ◆ (it takes the winning class's color once predicted).
- **Font:** System font only (`"Segoe UI", system-ui, sans-serif`). No external fonts, no CDN, everything bundled. After the first load the page must work offline.
- **Readability at the 1280×720 reference viewport:**
  - Ders mode: body text ≥ 22 px, step title and prediction ≥ 32 px, axis titles and tick labels ≥ 18 px.
  - Laboratuvar mode: body text ≥ 16 px.
  - SVG text must render at true CSS px (the SVG is sized to its container in px, no `viewBox` scaling of text).
- **Smoothness:** Target ~60 fps on an integrated-GPU laptop. Decision regions are drawn on a `<canvas>`, never as many SVG elements. Recomputing regions plus redrawing during a k-slider drag must stay under 16 ms (p95).
- **Mode:** Mode lives in the URL: `?mod=ders` or `?mod=lab`. Default is `lab`. It is not persisted anywhere else.
- **Keyboard, both modes:**
  - Steps: `→`/`Space` next, `←` prev, `P` play/pause, `F` fullscreen, `Home`/`End` first/last, `?` help.
  - k-NN extras: `+`/`-` k, `M` metric, `S` scaling, `D` dataset, `B` regions.
- **k-NN parameters:**
  - k: odd values 1–15, default 5.
  - Metric: Öklid | Manhattan, default Öklid.
  - Oylama: Eşit | Uzaklığa göre ağırlıklı (1/d), default Eşit.
  - Ölçekleme: StandardScaler on/off, default on.
  - Veri seti: "Sözleşme × Aylık fatura" (default) | "Sözleşme × Toplam fatura".
- **sklearn parity:** For the same data and parameters, neighbours and predictions must equal sklearn `KNeighborsClassifier(algorithm="brute")`.
  - Ties at equal distance break by data order (lower index first).
  - Vote ties go to the smaller label: Kaldı = 0, Ayrıldı = 1.
  - StandardScaler uses population std (ddof = 0) and is fit on the displayed sample.
- **Data:** The book CSV `C:\projects\ModernVeriMadenGiris\datasets\telco_churn_synthetic.csv` (sha256 `b522990b1e66edd6b144657280df505b2dcc2aed0be867176793655cbf1f7720`). Sample with `random_seed = 42`.
- **Deployment:** Vite `base: './'`, so the site works under any GitHub Pages repo path.
- **Commits:** Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Keys while a form control has focus.** Pressing `←`/`→`/`Space`/`Home`/`End` while the k slider, a select or a button has focus must change only that control, not the step. Owning task: Task 6 (`ignores step keys when focus is in a form control`).
2. **Query exactly on a training point with weighted voting.** There must be no `Infinity`/`NaN`. Zero-distance neighbours get weight 1 and all others weight 0, as in sklearn. Owning task: Task 3 (`weighted vote with zero distance matches sklearn`).
3. **Resize or fullscreen mid-step.** The scene re-lays out at the new pixel size, text keeps its CSS px size (no stretching) and the current step is unchanged. Owning tasks: Task 10 (`resize keeps text px size`) and Task 14 (`fullscreen keeps step`).
4. **Holding `→`, or rapid next/prev during transitions.** The final DOM must match the final step, with no half-drawn lines or stale badges, because running transitions are interrupted. Owning task: Task 10 (`rapid step changes end in final state`).
5. **Lab click or drag outside the plot area or beyond the axes.** The query is clamped into the data domain and never lost off-screen. A manual dataset switch resets the query to that dataset's default. Owning tasks: Task 11 (`clamps query to domain`) and Task 8 (`switchDataset resets query`).

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, .gitignore, README.md
index.html                         Home page entry
knn/index.html                     k-NN page entry
.github/workflows/deploy.yml       Unit tests + build + Pages deploy
scripts/make_knn_data.py           Samples the book CSV → JSON data + sklearn fixtures + demo positions
scripts/requirements.txt
src/core/player.ts                 Step, Scenario, StepPlayer (concept-agnostic state machine)
src/core/mode.ts                   Mode type, read/write ?mod=
src/core/keyboard.ts               Global key binding, Shortcut type, isFormControl
src/core/shell.ts                  ConceptPage interface + mountConceptPage (top bar, stage, player bar, panels, help)
src/core/theme.css                 Tokens, layout, mode-dependent font sizes
src/concepts/registry.ts           Concept list for the home page (chapter, title, status, href)
src/home/main.ts                   Home page rendering
src/concepts/knn/data/telco_sample.json   (generated, committed)
src/concepts/knn/data.ts           Typed access to the JSON
src/concepts/knn/knn.ts            Scaler, distance, kNearest, vote
src/concepts/knn/space.ts          Feature space for (dataset, scaled)
src/concepts/knn/regions.ts        Decision-region grid computation
src/concepts/knn/scenario.ts       KnnParams, 12 steps, shortcuts, switchDataset
src/concepts/knn/view.ts           deriveKnnView (pure)
src/concepts/knn/viewport.ts       fitEqualAspect (pure)
src/concepts/knn/scene.ts          SVG + canvas renderer
src/concepts/knn/controls.ts       Parameter panel
src/concepts/knn/table.ts          Lab distance table
src/concepts/knn/main.ts           Page wiring + lab pointer interaction
tests/fixtures/knn_sklearn.json    (generated, committed)
tests/unit/*.test.ts               Vitest
tests/e2e/*.spec.ts                Playwright (run locally)
```

---

### Task 1: Project scaffold and git

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `knn/index.html`, `src/home/main.ts`, `src/concepts/knn/main.ts`, `tests/unit/smoke.test.ts`

**Interfaces:**
- Produces:
  - npm scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`), `test:e2e` (`playwright test`).
  - Vite inputs `main: index.html` and `knn: knn/index.html`; `base: './'`.

- [ ] **Step 1:** Run `git init` in `C:\projects\vmAnimation`. Create `.gitignore` with `node_modules/`, `dist/`, `.superpowers/`, `test-results/`, `playwright-report/`.
- [ ] **Step 2:** Create `package.json` (`"type": "module"`, `"private": true`, name `vm-animasyon`). Install:
  - dev: `vite typescript vitest jsdom @playwright/test @types/d3-scale @types/d3-selection @types/d3-transition @types/d3-ease`
  - deps: `d3-scale d3-selection d3-transition d3-ease`
- [ ] **Step 3:** Create `tsconfig.json` (strict, `"module": "ESNext"`, `"moduleResolution": "bundler"`, `"resolveJsonModule": true`, `"lib": ["ES2022","DOM","DOM.Iterable"]`, include `src`, `tests`). Create `vite.config.ts` with `base: './'`, the two rollup inputs, and `test: { include: ['tests/unit/**/*.test.ts'] }`.
- [ ] **Step 4:** Create minimal `index.html` and `knn/index.html` (`<html lang="tr">`, `<div id="app">`, module script to their `main.ts`). Each `main.ts` writes a placeholder heading. Write `tests/unit/smoke.test.ts` asserting `1 + 1 === 2`.
- [ ] **Step 5:** Run `npm test` (expect 1 passed) and `npm run build` (expect `dist/index.html` and `dist/knn/index.html` to exist).
- [ ] **Step 6:** Commit, including the already-written `docs/` spec and plan: `chore: scaffold Vite + TS project`.

### Task 2: Data and sklearn fixtures generator

**Files:**
- Create: `scripts/make_knn_data.py`, `scripts/requirements.txt` (`pandas`, `scikit-learn`)
- Generated (commit): `src/concepts/knn/data/telco_sample.json`, `tests/fixtures/knn_sklearn.json`

**Interfaces:**
- Produces `telco_sample.json`:
  ```json
  { "source": "telco_churn_synthetic.csv", "sha256": "…", "seed": 42,
    "customers": [{ "id": "C00001", "tenure": 7, "monthly": 18.0, "total": 153.98, "churn": 1 }],
    "demo": {
      "defaultQuery": { "aylik": {"tenure": 0, "value": 0}, "toplam": {"tenure": 0, "value": 0} },
      "kSwallow":    {"tenure": 0, "value": 0},
      "metricSplit": {"tenure": 0, "value": 0},
      "scaleSplit":  {"tenure": 0, "value": 0} } }
  ```
  `churn`: 1 = Ayrıldı (CSV `Yes`), 0 = Kaldı. `value` is the y feature of the named dataset (`aylik` → MonthlyCharges, `toplam` → TotalCharges).
- Produces `knn_sklearn.json`: `{ "cases": [{ "dataset": "aylik"|"toplam", "scaled": bool, "metric": "oklid"|"manhattan", "weighting": "esit"|"agirlikli", "k": int, "query": {"tenure","value"}, "neighbors": [int…], "prediction": 0|1, "proba": [p0, p1] }] }`. Neighbor indices refer to `customers` order, sorted by (distance, index).

- [ ] **Step 1: Implement `scripts/make_knn_data.py <csv_path>`.**
  - Verify the sha256 against Global Constraints; exit non-zero on mismatch.
  - Sample is stratified: 36 rows with `Churn=No` and 12 with `Churn=Yes`, via `groupby('Churn').sample(n, random_state=42)`. This keeps the book's ~26 % churn and lets a large k swallow the minority. Concatenate No-then-Yes, then shuffle with `random_state=42`.
  - Demo positions are found by grid search over integer tenure 1..72 and y on an integer grid: monthly 18..120 step 1, total 18..8609 step 25. Each position must satisfy:
    - `defaultQuery.aylik`: scaled, euclid, uniform, k=5 → vote 3–2 (either winner), nearest to the plot centre.
    - `defaultQuery.toplam`: same rule on the `toplam` dataset.
    - `kSwallow` (aylik, scaled, euclid): prediction 1 for k ∈ {1,3,5} and 0 for k = 15.
    - `metricSplit` (aylik, scaled, k=5): the euclid and manhattan neighbour sets differ by ≥ 2 members.
    - `scaleSplit` (toplam, euclid, k=5): scaled and unscaled neighbour sets share ≤ 2 members. Prefer, among those, points where the predictions also differ.
  - Exit non-zero with a clear message if any search finds nothing.
- [ ] **Step 2: Fixtures.** For each dataset, draw 20 uniform random queries (seed 42) inside the data range. Add, for each dataset, 1 query placed exactly on `customers[0]`. Cover every combination of k ∈ {1,3,5,9,15} × metric × weighting × scaled.
  - Use `KNeighborsClassifier(n_neighbors=k, metric='euclidean'|'manhattan', weights='uniform'|'distance', algorithm='brute')`, with a `StandardScaler()` fit on the 48 points when scaled.
  - **Skip a case** when the k-th and (k+1)-th distances are equal within 1e-9 (an ambiguous boundary set).
  - Store neighbours sorted by (distance, index).
- [ ] **Step 3:** Run `python scripts/make_knn_data.py C:/projects/ModernVeriMadenGiris/datasets/telco_churn_synthetic.csv`. Expect both files written, 48 customers, and every demo key present. Print the case count, which should be ≥ 3000.
- [ ] **Step 4:** Commit: `feat(data): sample book Telco data and sklearn fixtures`.

### Task 3: k-NN math

**Files:**
- Create: `src/concepts/knn/data.ts`, `src/concepts/knn/knn.ts`
- Test: `tests/unit/knn.test.ts`

**Interfaces:**
- Consumes: the JSON files from Task 2.
- Produces (`data.ts`):
  - `type DatasetId = 'aylik' | 'toplam'`
  - `interface RawPoint { tenure: number; value: number }`
  - `interface Customer { id: string; tenure: number; monthly: number; total: number; churn: 0 | 1 }`
  - `const customers: Customer[]`
  - `const demo: { defaultQuery: Record<DatasetId, RawPoint>; kSwallow: RawPoint; metricSplit: RawPoint; scaleSplit: RawPoint }`
  - `function rawPoint(c: Customer, d: DatasetId): RawPoint`
- Produces (`knn.ts`):
  - `type Metric = 'oklid' | 'manhattan'`
  - `type Weighting = 'esit' | 'agirlikli'`
  - `interface Vec { x: number; y: number }`
  - `interface Scaler { mean: Vec; std: Vec }`
  - `fitScaler(points: Vec[]): Scaler`
  - `applyScaler(p: Vec, s: Scaler | null): Vec`
  - `invertScaler(p: Vec, s: Scaler | null): Vec`
  - `distance(a: Vec, b: Vec, m: Metric): number`
  - `interface Neighbor { index: number; distance: number; weight: number; cls: 0 | 1 }`
  - `kNearest(points: Vec[], labels: (0|1)[], q: Vec, k: number, m: Metric, w: Weighting): Neighbor[]`, sorted by (distance, index). `weight` is 1 for `esit`; for `agirlikli` it is 1/d, except that when any neighbour has d = 0, those neighbours get 1 and the rest 0.
  - `interface Vote { scores: [number, number]; winner: 0 | 1 }`
  - `vote(n: Neighbor[]): Vote`. Ties go to winner 0.

- [ ] **Step 1: Write failing tests** in `tests/unit/knn.test.ts`:
  - `fitScaler uses population std`: points (0,0),(2,4) → mean (1,2), std (1,2).
  - `distance`: (0,0)-(3,4) oklid 5, manhattan 7.
  - `vote tie goes to Kaldı`: scores [1,1] → winner 0.
  - `weighted vote with zero distance matches sklearn`: q equals point 0 → that neighbour has weight 1, the others 0, all finite.
  - `matches sklearn fixtures`: for every fixture case, build points through `rawPoint` + optional `fitScaler`/`applyScaler`, then assert identical `neighbors` indices, equal `prediction`, and `scores[i]/sum ≈ proba[i]` (1e-9).
- [ ] **Step 2:** Run `npx vitest run tests/unit/knn.test.ts`. Expect FAIL (module missing).
- [ ] **Step 3:** Implement `data.ts` (typed re-export of the JSON) and `knn.ts` with the signatures above.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(knn): distance, neighbours and voting with sklearn parity`.

### Task 4: Feature space and decision regions

**Files:**
- Create: `src/concepts/knn/space.ts`, `src/concepts/knn/regions.ts`
- Test: `tests/unit/space.test.ts`, `tests/unit/regions.test.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces (`space.ts`):
  ```ts
  interface FeatureSpace {
    dataset: DatasetId;
    scaled: boolean;
    points: Vec[];                        // in distance space
    labels: (0|1)[];
    scaler: Scaler | null;
    toSpace(r: RawPoint): Vec;
    toRaw(v: Vec): RawPoint;
    domain: { x: [number, number]; y: [number, number] };  // point extent padded 8% each side
  }
  featureSpace(d: DatasetId, scaled: boolean): FeatureSpace   // memoised per (d, scaled)
  ```
- Produces (`regions.ts`):
  - `interface RegionGrid { cols: number; rows: number; x0: number; x1: number; y0: number; y1: number }`. The bounds are in space units, and row 0 is the top (y1).
  - `computeRegions(s: FeatureSpace, k: number, m: Metric, w: Weighting, g: RegionGrid, out?: Uint8Array): Uint8Array`. It returns the class per cell centre, row-major. It reuses `out` when given and must not allocate per cell. Use a fixed-size insertion buffer of length k, not a full sort.

- [ ] **Step 1: Write failing tests:**
  - `toRaw(toSpace(r))` round-trips (1e-9) for both datasets, scaled and unscaled.
  - Scaled points have mean ≈ 0 and std ≈ 1.
  - `featureSpace` returns the same object for repeated arguments.
  - `computeRegions agrees with vote(kNearest)` on 200 random cells for k ∈ {1,5,15} × both metrics × both weightings.
  - `computeRegions is fast`: a 220×120 grid with k=15 averages < 8 ms over 20 runs in Node. This is a budget guard; the browser check is in Task 14.
- [ ] **Step 2:** Run `npx vitest run tests/unit/space.test.ts tests/unit/regions.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement both files to the signatures.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(knn): feature space and fast decision regions`.

### Task 5: StepPlayer (core)

**Files:**
- Create: `src/core/player.ts`
- Test: `tests/unit/player.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface Step<P> {
    id: string; title: string; text: string;
    params?: Partial<P>;
    sweep?: { key: keyof P; values: unknown[]; intervalMs: number };
  }
  interface Scenario<P> { defaults: P; steps: Step<P>[] }
  type ChangeCause = 'step' | 'param' | 'sweep';
  interface PlayerState<P> { index: number; count: number; step: Step<P>; params: P; playing: boolean }
  class StepPlayer<P extends object> {
    constructor(scenario: Scenario<P>, opts?: { autoplayMs?: number /* default 3500 */ });
    get state(): PlayerState<P>;
    goto(i: number): void;   // clamps to [0, count-1]
    next(): void; prev(): void; first(): void; last(): void;
    setParam<K extends keyof P>(key: K, value: P[K]): void;
    play(): void; pause(): void; togglePlay(): void;
    subscribe(fn: (s: PlayerState<P>, cause: ChangeCause) => void): () => void;
    destroy(): void;
  }
  ```
- Semantics (from spec §6, "Ortak iskelete etkisi"):
  - Effective params = `defaults` ⊕ `steps[0..index].params`, applied in order ⊕ manual overrides.
  - `setParam` records an override, keeps the current step, and cancels any running sweep on that key.
  - `goto(j)` deletes the overrides for keys that `steps[j].params` sets, then applies.
  - On entering a step with `sweep`, values are applied one per `intervalMs` (cause `'sweep'`) and end at the step's own value. Leaving the step cancels the sweep.
  - Play advances every `autoplayMs` and stops at the last step.

- [ ] **Step 1: Write failing tests** (vitest fake timers):
  - `cumulative step params`: defaults {k:5,m:'a'}, steps [{}, {params:{k:1}}, {params:{m:'b'}}]. goto(2) → {k:1,m:'b'}; goto(1) → {k:1,m:'a'}; goto(0) → {k:5,m:'a'}.
  - `manual override survives steps that do not set it`: setParam('k',9) at index 0; goto(0→… a step without k) keeps 9.
  - `step that owns a key clears its override`: setParam('k',9), goto(1) → k=1.
  - `goto clamps`: goto(99) → index count-1.
  - `sweep applies values then ends at step value`: values [1,3,5], intervalMs 100; after 300 ms the subscriber saw k=1,3,5 with cause 'sweep'.
  - `leaving a sweeping step cancels it`.
  - `play stops at last step`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/player.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `src/core/player.ts`.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(core): StepPlayer with step-owned params and sweeps`.

### Task 6: Mode and keyboard (core)

**Files:**
- Create: `src/core/mode.ts`, `src/core/keyboard.ts`
- Test: `tests/unit/mode.test.ts`, `tests/unit/keyboard.test.ts` (both `// @vitest-environment jsdom`)

**Interfaces:**
- Produces (`mode.ts`):
  - `type Mode = 'ders' | 'lab'`
  - `readMode(search: string): Mode`. Anything other than `ders` gives `'lab'`.
  - `writeMode(mode: Mode): void`. It uses `history.replaceState` and keeps other query params.
- Produces (`keyboard.ts`):
  - `interface Shortcut { keys: string[]; label: string; run(): void }`, where `keys` are `KeyboardEvent.key` values.
  - `isFormControl(el: EventTarget | null): boolean`. True for input, select, textarea, button and contenteditable.
  - `bindKeys(target: Window, player: StepPlayer<any>, actions: { toggleFullscreen(): void; toggleHelp(): void }, extra: Shortcut[]): () => void`
  - Built-in keys: `ArrowRight`/` ` → next; `ArrowLeft` → prev; `p`/`P` → togglePlay; `f`/`F` → toggleFullscreen; `Home`/`End`; `?` → toggleHelp. Handled keys call `preventDefault`. Modifier combinations (Ctrl/Alt/Meta) are ignored.

- [ ] **Step 1: Write failing tests:**
  - `readMode`: `?mod=ders` → 'ders'; '' → 'lab'; `?mod=x` → 'lab'.
  - `writeMode keeps other params`: `?a=1` → `?a=1&mod=ders`.
  - `ArrowRight advances`.
  - `Space advances`.
  - `ignores step keys when focus is in a form control`: dispatch ArrowRight/Space/Home with the target an `<input type=range>` → player index unchanged.
  - `extra shortcut runs`.
  - `Ctrl+ArrowRight ignored`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/mode.test.ts tests/unit/keyboard.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement both files.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(core): URL mode and keyboard bindings`.

### Task 7: Shell and theme (core)

**Files:**
- Create: `src/core/shell.ts`, `src/core/theme.css`
- Test: `tests/unit/shell.test.ts` (jsdom)

**Interfaces:**
- Consumes: Tasks 5 and 6.
- Produces:
  ```ts
  interface SceneHandle { resize(widthPx: number, heightPx: number): void; setMode(m: Mode): void; destroy(): void }
  interface ConceptPage<P extends object> {
    title: string;                 // "k-En Yakın Komşu (k-NN)"
    chapter: string;               // "Bölüm 5 · Sınıflandırmaya Giriş"
    scenario: Scenario<P>;
    mountScene(el: HTMLElement, player: StepPlayer<P>, mode: Mode): SceneHandle;
    mountParams(el: HTMLElement, player: StepPlayer<P>): void;
    mountExplainExtra?(el: HTMLElement, player: StepPlayer<P>): void;  // lab-only content under step text
    shortcuts?(player: StepPlayer<P>): Shortcut[];
  }
  mountConceptPage<P extends object>(root: HTMLElement, page: ConceptPage<P>): { player: StepPlayer<P>; destroy(): void }
  ```
- DOM contract (used by tests and e2e):
  - `root[data-mode]`
  - `.top-bar` containing:
    - `.title`, `.chapter`, and a `a.home` link to `../`
    - `.mode-toggle` with two buttons, `[data-mode-btn=ders]` and `[data-mode-btn=lab]`, labelled "🎓 Ders" and "🧪 Laboratuvar"
  - `.stage`
  - `.player-bar`:
    - `button.prev`, `button.play`, `button.next`
    - `.steps` with one `button.step-dot` per step; the current one has `aria-current="step"`
    - `.step-count`, reading `Adım 3 / 12`
  - `.params` (in Ders mode it is collapsed behind a `button.params-toggle` labelled "Parametreler")
  - `.explain` with `.step-title`, `.step-text` and `.explain-extra`. In Ders mode only `.step-title` is visible, rendered large over the stage bottom.
  - `.help` overlay, hidden by default, listing all built-in and extra shortcuts.
- The stage size is observed with `ResizeObserver` and forwarded to `SceneHandle.resize` in px. `toggleFullscreen` uses `document.documentElement.requestFullscreen` / `document.exitFullscreen`.
- `theme.css`:
  - Defines the color tokens from Global Constraints.
  - Font-size tokens `--fs-body`, `--fs-title`, `--fs-axis`, `--fs-tick`, set per `[data-mode]`:
    - ders: 22 / 32 / 18 / 18 px minimum (use `max(22px, 1.8vw)` style clamps)
    - lab: 16 / 22 / 14 / 13 px
  - Layout:
    - Ders: stage ≈ full viewport minus top bar and player bar.
    - Lab: CSS grid with the stage ≈ 60 % width; params and explain in the right column (stacked under the stage below 900 px width).

- [ ] **Step 1: Write failing tests** with a dummy 3-step scenario and a stub `mountScene` that records resize/setMode:
  - `renders step dots and count`: 3 dots, "Adım 1 / 3".
  - `clicking a dot goes to that step`.
  - `mode toggle sets data-mode, URL and calls setMode`.
  - `Ders mode collapses params`.
  - `explain shows current step title and text`.
  - `help lists extra shortcuts`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/shell.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `shell.ts` and `theme.css`.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(core): concept page shell, modes and theme`.

### Task 8: k-NN scenario

**Files:**
- Create: `src/concepts/knn/scenario.ts`
- Test: `tests/unit/scenario.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 4 and 5.
- Produces:
  ```ts
  interface KnnParams {
    k: number; metric: Metric; weighting: Weighting; scaled: boolean;
    dataset: DatasetId; regions: boolean; query: RawPoint; instant: boolean;
  }
  const knnScenario: Scenario<KnnParams>;
  // defaults: k 5, oklid, esit, scaled true, aylik, regions false, query demo.defaultQuery.aylik, instant false
  function switchDataset(p: StepPlayer<KnnParams>, d: DatasetId): void;  // sets dataset + query = demo.defaultQuery[d]
  function knnShortcuts(p: StepPlayer<KnnParams>): Shortcut[];  // + - (next/prev odd k within 1..15), M, S, D (via switchDataset), B
  ```
- Steps (index · id · title · params). The text column is the exact Turkish copy shown in `.step-text`:

| # | id | title | params | text |
|---|---|---|---|---|
| 0 | veri | Eğitim verisi | `{regions:false}` | Her nokta bir müşteri. k-NN eğitimde hiçbir şey öğrenmez; veriyi yalnızca saklar: tembel öğrenme (lazy learning). |
| 1 | yeni | Yeni müşteri geldi | — | Bu müşterinin kalıp kalmayacağını bilmiyoruz. Komşularına bakarak tahmin edeceğiz. |
| 2 | uzaklik | Uzaklıkları ölç | — | Yeni müşteriden her müşteriye olan uzaklık hesaplanır. |
| 3 | komsu | En yakın k komşuyu seç | — | Uzaklıklar küçükten büyüğe sıralanır; ilk k müşteri en yakın komşudur (nearest neighbor). |
| 4 | oylama | Oylama ve tahmin | — | Komşular kendi sınıflarına oy verir; çoğunluk kazanır. |
| 5 | k1 | k = 1: tek komşu | `{dataset:'aylik', scaled:true, metric:'oklid', weighting:'esit', k:1, regions:true, query: demo.kSwallow}` | Arka plan, her bölgeye verilecek tahmini gösteriyor. k = 1'de sınır tırtıklı: tek bir müşteri bile kararı değiştirir. |
| 6 | kbuyur | k büyüyor | `{k:9}`, `sweep {key:'k', values:[1,3,5,7,9], intervalMs:700}` | k büyüdükçe sınır yumuşar; karar daha çok komşuya dayanır. |
| 7 | kcok | Çok büyük k | `{k:15}` | Komşuluk çok genişledi: azınlıktaki Ayrıldı sınıfı yutuldu, tahmin değişti. |
| 8 | oklid | Komşuluk: Öklid | `{k:5, metric:'oklid', query: demo.metricSplit}` | Öklid uzaklığında komşuluk bir dairedir (kuş uçuşu). |
| 9 | manhattan | Komşuluk: Manhattan | `{metric:'manhattan'}` | Manhattan uzaklığında komşuluk bir elmastır; seçilen komşular değişti. |
| 10 | toplam | Toplam fatura, ölçekli | `{dataset:'toplam', scaled:true, metric:'oklid', k:5, query: demo.scaleSplit}` | Dikey eksen artık toplam fatura (kısmen süre × aylık faturadan türer). Ölçekleme açık: iki öznitelik eşit söz sahibi. |
| 11 | olceksiz | Ölçekleme kapalı | `{scaled:false}` | Ham değerlerde toplam fatura uzaklığı ele geçirir, sözleşme süresi neredeyse hiç sayılmaz. k-NN'de ölçekleme zorunludur. |

- [ ] **Step 1: Write failing tests.** Each one plays the scenario through a `StepPlayer` and checks the effect with Task 3/4 functions:
  - `has 12 steps with unique ids`.
  - `step 4 default query vote is 3–2`.
  - `k1 → kcok flips prediction from Ayrıldı to Kaldı`.
  - `Ayrıldı region shrinks`: the Ayrıldı cell count on an 80×50 grid at step 7 is < 50 % of the count at step 5.
  - `oklid → manhattan changes ≥ 2 neighbours`.
  - `toplam → olceksiz keeps ≤ 2 shared neighbours`.
  - `switchDataset resets query` to `demo.defaultQuery[d]`.
  - `+ stops at 15, - stops at 1, both stay odd`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/scenario.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `scenario.ts`.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(knn): 12-step scenario with demonstration steps`.

### Task 9: k-NN view derivation

**Files:**
- Create: `src/concepts/knn/view.ts`
- Test: `tests/unit/view.test.ts`

**Interfaces:**
- Consumes: Tasks 3, 4 and 8.
- Produces:
  ```ts
  type Phase = 0 | 1 | 2 | 3 | 4;   // veri, yeni, uzaklik, komsu, oylama
  interface KnnView {
    phase: Phase;                    // min(stepIndex, 4)
    space: FeatureSpace;
    query: Vec;                      // in space units
    showQuery: boolean;              // phase ≥ 1
    distances: Neighbor[];           // ALL points sorted (distance, index), weights per params
    neighbors: Neighbor[];           // first k of distances; shown when phase ≥ 3
    showLines: 'none' | 'all' | 'neighbors';   // phase 2 → 'all', phase ≥ 3 → 'neighbors'
    radius: number;                  // distance of k-th neighbour (space units)
    metric: Metric;
    vote: Vote | null;               // phase ≥ 4
    prediction: { cls: 0 | 1; label: 'KALACAK' | 'AYRILACAK'; detail: string } | null;
    regions: boolean;
    k: number; weighting: Weighting;
  }
  deriveKnnView(stepIndex: number, p: KnnParams): KnnView
  ```
  `detail` is `"3/5 oy"` for esit and `"ağırlığın %62'si"` for agirlikli (the winner's share, rounded).

- [ ] **Step 1: Write failing tests:**
  - Phase and visibility flags for stepIndex 0..4, and 11 → phase 4.
  - `neighbors` equal `kNearest` for the step's params.
  - `radius` equals `neighbors[k-1].distance`.
  - Detail strings for both weightings.
  - `distances.length === 48`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/view.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `view.ts`.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(knn): pure view derivation`.

### Task 10: k-NN scene renderer

**Files:**
- Create: `src/concepts/knn/viewport.ts`, `src/concepts/knn/scene.ts`
- Test: `tests/unit/viewport.test.ts`, `tests/unit/scene.test.ts` (jsdom)

**Interfaces:**
- Consumes: Tasks 7 and 9.
- Produces (`viewport.ts`):
  - `fitEqualAspect(domain: {x:[number,number]; y:[number,number]}, rect: {left:number; top:number; width:number; height:number}): { x: ScaleLinear<number,number>; y: ScaleLinear<number,number> }`
  - One space unit is the same number of px on both axes. The content is centred in `rect` (letterboxed), and y is inverted.
- Produces (`scene.ts`):
  - `mountKnnScene(el: HTMLElement, player: StepPlayer<KnnParams>, mode: Mode, opts?: { durationScale?: number }): SceneHandle & { onPointer(cb: (raw: RawPoint, kind: 'down'|'move'|'up') => void): void }`
  - `durationScale` defaults to 1; tests pass 0.
- Rendering contract, read from `deriveKnnView(state.index, state.params)` on every player change:
  - **Layers:** a `<canvas class="regions">` under an `<svg class="plot">`, both sized to the stage in CSS px with devicePixelRatio backing. The SVG has no `viewBox`; text uses the CSS classes `axis-title` (`--fs-axis`) and `tick` (`--fs-tick`).
  - **Axes:**
    - Unscaled titles: "Sözleşme süresi (ay)" and "Aylık fatura (TL)" or "Toplam fatura (TL)".
    - Scaled titles append " — standartlaştırılmış (z)".
    - Ticks come from the d3 scale.
  - **Points:** Kaldı is `circle.pt.kaldi`, Ayrıldı is `path.pt.ayrildi` (triangle). From phase ≥ 3, non-neighbours get opacity 0.35 and neighbours get a 2.5 px navy stroke.
  - **Query:** `rect.query` rotated 45°, white fill until the prediction exists, then the class color. It has a "Yeni müşteri" label.
  - **Lines:** `line.dist` from the query to each point per `showLines`. In phase 2 they grow from the query.
  - **Ranks:** `g.rank` badges numbered 1..k from phase ≥ 3.
  - **Boundary:** `path.boundary`, drawn as a circle for oklid or a diamond for manhattan with the given `radius`, from phase ≥ 3.
  - **Vote bar:** `g.vote` with two segments ("● Kaldı: x", "▲ Ayrıldı: y", scores rounded to 2 decimals when weighted) and `text.prediction`, reading "Tahmin: AYRILACAK (3/5 oy)" (`--fs-title`), from phase 4.
  - **Regions:** when `regions` is set, computed with `computeRegions` at about one cell per 6 CSS px of the plot rect and drawn at 0.12 alpha with class colors. Each draw is wrapped in `performance.mark('regions-start')` / `performance.measure('regions', 'regions-start')`. A null 2D context (jsdom) is a no-op.
  - **Transitions:**
    - Named per element group, 450 ms × `durationScale`.
    - Changing the domain (dataset or scaled) animates scales over 900 ms.
    - Each render first calls `.interrupt()` on all groups, so rapid changes always end in the final state.
  - **Resize:** `resize(w,h)` recomputes the plot rect and redraws without transition.

- [ ] **Step 1: Write failing tests:**
  - viewport: `equal px per unit on both axes` (x-domain 0..10, y-domain 0..100, rect 500×300 → `x(1)-x(0) === y(0)-y(1)`); `content fits inside rect`.
  - scene, with `durationScale: 0`:
    - `48 points, 36 circles + 12 triangles` (counts from data).
    - `phase 2 draws 48 lines, phase 3 draws k lines and k rank badges`.
    - `boundary is circle for oklid and 4-vertex path for manhattan`.
    - `prediction text at step 4 matches view.prediction`.
    - `rapid step changes end in final state`: goto 2,3,4,1 synchronously → 0 lines, 0 badges, no `.prediction`.
    - `resize keeps text px size`: after `resize(1280,600)` and `resize(800,400)`, `.axis-title` has no `transform: scale` and the svg has no `viewBox`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/viewport.test.ts tests/unit/scene.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `viewport.ts` and `scene.ts`.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(knn): SVG + canvas scene renderer`.

### Task 11: k-NN controls, lab table and page wiring

**Files:**
- Create: `src/concepts/knn/controls.ts`, `src/concepts/knn/table.ts`
- Modify: `src/concepts/knn/main.ts`, `knn/index.html`
- Test: `tests/unit/controls.test.ts` (jsdom)

**Interfaces:**
- Consumes: Tasks 7, 8, 9 and 10.
- Produces:
  - `mountKnnParams(el: HTMLElement, p: StepPlayer<KnnParams>): void`, which renders:
    - k: range 1–15, step 2, with the value shown
    - Uzaklık ölçüsü: select Öklid/Manhattan
    - Oylama: select Eşit / Uzaklığa göre ağırlıklı
    - Ölçekleme: checkbox
    - Veri seti: select, which goes through `switchDataset`
    - Karar bölgeleri: checkbox
    - Anında sonuç: checkbox
    All controls are two-way bound, so step changes update them.
  - `mountKnnTable(el: HTMLElement, p: StepPlayer<KnnParams>): void`
    - Shows a sorted table of `view.distances` from phase ≥ 2, with columns #, Sınıf (● / ▲ + name), Uzaklık (2 decimals) and, when weighting is agirlikli, Ağırlık (3 decimals).
    - Rows 1..k get class `neighbor` from phase ≥ 3; the other rows are dimmed.
    - The table scrolls inside its panel.
  - `clampToDomain(v: Vec, domain: FeatureSpace['domain']): Vec`, exported from `main.ts` for testing.
- Page wiring (`main.ts`):
  - `mountConceptPage(app, { title: 'k-En Yakın Komşu (k-NN)', chapter: 'Bölüm 5 · Sınıflandırmaya Giriş', scenario: knnScenario, mountScene: mountKnnScene, mountParams: mountKnnParams, mountExplainExtra: mountKnnTable, shortcuts: knnShortcuts })`
  - Lab pointer handling, active only in lab mode:
    - On `down`: set `query` to the clamped raw point, then `goto(instant ? 4 : 1)`.
    - On `move` while dragging: set `query` only, and keep the step at ≥ 4 so that the neighbours, boundary and vote update live.

- [ ] **Step 1: Write failing tests:**
  - `controls reflect step params`: goto(9) → metric select shows Manhattan.
  - `k slider sets override and keeps step`.
  - `dataset select resets query`.
  - `table shows weight column only when weighted`.
  - `clamps query to domain`: a point beyond both domain ends is clamped to the domain edges.
- [ ] **Step 2:** Run `npx vitest run tests/unit/controls.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `controls.ts`, `table.ts` and the `main.ts` wiring. Set `<title>k-NN · Veri Madenciliği Animasyonları</title>` in `knn/index.html` and import `src/core/theme.css`.
- [ ] **Step 4:** Run `npm test` (all unit tests). Expect PASS. Then run `npm run dev`, open `/knn/?mod=ders` and `/knn/`, step through all 12 steps by keyboard, and click and drag in lab mode. Expect the behaviour described in spec §6.
- [ ] **Step 5:** Commit: `feat(knn): parameter panel, distance table and lab interaction`.

### Task 12: Home page

**Files:**
- Create: `src/concepts/registry.ts`
- Modify: `src/home/main.ts`, `index.html`
- Test: `tests/unit/home.test.ts` (jsdom)

**Interfaces:**
- Produces:
  - `interface ConceptEntry { id: string; chapter: number; chapterTitle: string; title: string; status: 'hazir' | 'yakinda'; href?: string }`
  - `const concepts: ConceptEntry[]`
  - `renderHome(root: HTMLElement): void`
- Registry content, in book order. Only k-NN is `hazir`, with `href: 'knn/'`:
  - Ch2 EDA: Dağılım ve çarpıklık, Kutu grafiği.
  - Ch3: IQR ile aykırı değer, Ölçekleme.
  - Ch4: PCA.
  - Ch5: Karar ağacı (Gini/Entropi), k-NN, Naive Bayes.
  - Ch6: Karmaşıklık matrisi, ROC ve eşik, Çapraz doğrulama.
  - Ch7: K-Means, DBSCAN, Dendrogram.
  - Ch8: Apriori.
  - Ch9: Bootstrap ve Random Forest.
  - Ch10: Boosting.
  - Ch11: SMOTE.
  - Ch12: TF-IDF ve kosinüs benzerliği.
  - Ch13: SHAP.
  Chapter titles come from the book manifest, e.g. 5 → "Sınıflandırmaya Giriş: Karar Ağaçları, k-NN ve Naive Bayes".
- Layout:
  - A header with the book title "Modern Veri Madenciliğine Giriş", the subtitle "Kavram Animasyonları", the author "Prof. Dr. İsmail KIRBAŞ" and one intro sentence.
  - Chapter sections, each a grid of cards. A card shows the chapter badge, the title and a small inline SVG glyph.
  - `hazir` cards are links. `yakinda` cards are muted, carry a "Yakında" tag and are not links.

- [ ] **Step 1: Write failing tests:**
  - `one card per concept`.
  - `only hazir cards are links and k-NN links to knn/`.
  - `cards grouped under chapter headings in order`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/home.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `registry.ts` and `renderHome`. The page uses `theme.css` tokens.
- [ ] **Step 4:** Run the same command. Expect PASS.
- [ ] **Step 5:** Commit: `feat(home): concept index page`.

### Task 13: Deploy workflow and README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Workflow:
  - Triggers: on push to `main` and `workflow_dispatch`.
  - Job `build`: Node 24, `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact` with `dist`.
  - Job `deploy`: `actions/deploy-pages`, with permissions `pages: write` and `id-token: write`, and the `github-pages` environment.
- README (Turkish):
  - What the site is.
  - The live link placeholder `https://<kullanıcı>.github.io/<depo>/`.
  - Ders link usage (`?mod=ders`) and the keyboard table.
  - Local dev commands.
  - How to regenerate data (`python scripts/make_knn_data.py <csv>`).
  - "Yeni kavram ekleme": implement `ConceptPage`, add an HTML entry plus a Vite input, and flip the registry entry to `hazir`.

- [ ] **Step 1:** Write both files.
- [ ] **Step 2:** Run `npm ci && npm test && npm run build` locally. Expect success.
- [ ] **Step 3:** Commit: `ci: GitHub Pages deploy workflow and README`.

### Task 14: End-to-end checks (readability, smoothness, keyboard)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/knn.spec.ts`

**Interfaces:**
- Config:
  - `use: { channel: 'chrome', viewport: { width: 1280, height: 720 } }`
  - `webServer: { command: 'npm run build && npx vite preview --port 4173', url: 'http://localhost:4173/knn/' }`

- [ ] **Step 1: Write the tests:**
  - `ders keyboard walkthrough`:
    - Open `/knn/?mod=ders`.
    - Press `ArrowRight` 11 times, waiting 1 s each.
    - Expect `.step-count` to read "Adım 12 / 12" and `.prediction` to be visible.
    - Press `ArrowLeft` → "Adım 11 / 12".
  - `ders readability at 1280×720`, checked at steps 0, 4 and 11:
    - every visible `.step-title` and `.prediction` has computed font-size ≥ 32 px;
    - `.axis-title` and `.tick` ≥ 18 px;
    - `.step-text`, if visible, ≥ 22 px.
  - `lab readability`: `.step-text` and `.params label` ≥ 16 px.
  - `fullscreen keeps step`: at step 5 press `F` and then `Escape` → still "Adım 6 / 12", and the plot svg width equals the stage width.
  - `regions redraw under 16 ms`:
    - In lab mode go to step 5.
    - Set the k slider through 1..15 and back 3 times.
    - Collect `performance.getEntriesByName('regions')`.
    - Assert p95 duration < 16 ms.
  - `drag stays smooth`:
    - In lab mode, at step 4, drag the query across the plot in 60 mouse moves.
    - Record frame intervals with `requestAnimationFrame` during the drag.
    - Assert p95 < 25 ms.
  - `lab click moves query`: clicking the plot goes to "Adım 2 / 12". With "Anında sonuç" checked, it goes to "Adım 5 / 12".
- [ ] **Step 2:** Run `npx playwright test`. Expect all pass. If a performance assertion fails, optimise the regions/scene code, for example by lowering the region grid density or skipping SVG transitions during a drag. Do not loosen the thresholds.
- [ ] **Step 3:** Commit: `test(e2e): readability, smoothness and keyboard checks`.

### Task 15: Publish (requires the teacher's confirmation)

- [ ] **Step 1:** Ask the teacher for the GitHub account/org and the repo name, and whether it should be public. Do not create anything before a clear yes.
- [ ] **Step 2:** After confirmation, run `gh repo create <owner>/<name> --public --source . --push`. Then enable Pages with the GitHub Actions source via `gh api -X POST repos/<owner>/<name>/pages -f build_type=workflow`.
- [ ] **Step 3:** Wait for the workflow, then open `https://<owner>.github.io/<name>/` and `…/knn/?mod=ders`. Verify that both load. Update the README link and commit: `docs: live site link`.
