import { describe, expect, it } from 'vitest';
import { evaluationData } from '../../../src/concepts/degerlendirme/data';
import { averagePrecision, curvePoints, rocAuc } from '../../../src/concepts/degerlendirme/curves';
import { metrics } from '../../../src/concepts/degerlendirme/metrics';
import reference from '../../fixtures/degerlendirme_sklearn.json';

describe('generated evaluation data', () => {
  it('agrees with sklearn at every score threshold, ROC area, and AP', () => {
    expect(evaluationData.matrix).toEqual({ tn: 80, fp: 10, fn: 4, tp: 6 });
    for (const name of ['balanced', 'imbalanced'] as const) {
      for (const partition of ['validation', 'test'] as const) {
        const samples = evaluationData.scoreSets[name][partition];
        const expected = reference.scoreSets[name][partition];
        expect(rocAuc(samples)).toBeCloseTo(expected.rocAuc, 12);
        expect(averagePrecision(samples)).toBeCloseTo(expected.averagePrecision, 12);
        const points = curvePoints(samples);
        expect(points.map(p => p.threshold)).toEqual(expected.roc.map(p => p.threshold));
        points.forEach((point, i) => {
          expect(point.fpr).toBeCloseTo(expected.roc[i].fpr, 12);
          expect(point.tpr).toBeCloseTo(expected.roc[i].tpr, 12);
          if (i > 0) {
            const pr = expected.pr.find(p => p.threshold === point.threshold)!;
            expect(point.precision).toBeCloseTo(pr.precision, 12);
            expect(point.recall).toBeCloseTo(pr.recall, 12);
          }
        });
      }
    }
  });
  it('keeps every test identity out of every fold and validates each development id once', () => {
    const development = evaluationData.cv.samples.filter(s => s.partition === 'development');
    const developmentIds = development.map(s => s.id).sort();
    const testIds = evaluationData.cv.samples.filter(s => s.partition === 'test').map(s => s.id).sort();
    expect(development.length).toBeGreaterThanOrEqual(30);
    expect(development.length).toBeLessThanOrEqual(60);
    expect(development.filter(s => s.actual === 1).length).toBeGreaterThanOrEqual(5);
    expect(testIds.length).toBeGreaterThanOrEqual(10);
    expect(testIds.length).toBeLessThanOrEqual(20);
    expect(evaluationData.cv.runs).toHaveLength(8);
    expect(new Set(evaluationData.cv.runs.map(r => `${r.k}/${r.method}/${r.c}`)).size).toBe(8);
    for (const run of evaluationData.cv.runs) {
      expect(run.folds).toHaveLength(run.k);
      expect(run.folds.flatMap(f => f.validationIds).sort()).toEqual(developmentIds);
      for (const fold of run.folds) {
        expect(fold.trainIds.filter(id => fold.validationIds.includes(id))).toEqual([]);
        expect([...fold.trainIds, ...fold.validationIds].sort()).toEqual(developmentIds);
        expect(fold.predictions.map(p => p.id).sort()).toEqual([...fold.validationIds].sort());
        const training = development.filter(s => fold.trainIds.includes(s.id));
        fold.mean.forEach((mean, i) => {
          const expectedMean = training.reduce((sum, s) => sum + s.x[i], 0) / training.length;
          expect(mean).toBeCloseTo(expectedMean, 12);
          const variance = training.reduce((sum, s) => sum + (s.x[i] - expectedMean) ** 2, 0) / training.length;
          expect(fold.scale[i]).toBeCloseTo(Math.sqrt(variance) || 1, 12);
        });
        const c = { tn: 0, fp: 0, fn: 0, tp: 0 };
        for (const p of fold.predictions) {
          expect(development.find(s => s.id === p.id)?.actual).toBe(p.actual);
          c[p.actual ? (p.predicted ? 'tp' : 'fn') : (p.predicted ? 'fp' : 'tn')]++;
        }
        expect(fold.confusion).toEqual(c);
        expect(fold.f1).toBe(metrics(c).f1 ?? 0);
      }
      const mean = run.folds.reduce((sum, fold) => sum + fold.f1, 0) / run.k;
      expect(run.meanF1).toBeCloseTo(mean, 12);
      expect(run.stdF1).toBeCloseTo(Math.sqrt(run.folds.reduce((sum, fold) => sum + (fold.f1 - mean) ** 2, 0) / run.k), 12);
    }
    const candidates = evaluationData.cv.runs.filter(r => r.k === 5 && r.method === 'stratified')
      .sort((a, b) => b.meanF1 - a.meanF1 || a.c - b.c);
    expect(evaluationData.cv.selection.c).toBe(candidates[0].c);
    expect(evaluationData.cv.selection.meanF1).toBe(candidates[0].meanF1);
    expect(evaluationData.cv.selection.finalTest.predictions.map(p => p.id).sort()).toEqual(testIds);
    expect(evaluationData.cv.selection.finalTest.f1).toBe(metrics(evaluationData.cv.selection.finalTest.confusion).f1 ?? 0);
    evaluationData.cv.selection.fitMean.forEach((mean, i) => {
      expect(mean).toBeCloseTo(development.reduce((sum, s) => sum + s.x[i], 0) / development.length, 12);
    });
  });
  it('exposes class clumping in ordinary folds and approximate balance in stratified folds', () => {
    const counts = (method: 'kfold' | 'stratified') => evaluationData.cv.runs.find(r => r.k === 5 && r.method === method)!
      .folds.map(f => f.predictions.filter(p => p.actual === 1).length);
    const ordinary = counts('kfold');
    const stratified = counts('stratified');
    expect(Math.max(...ordinary) - Math.min(...ordinary)).toBeGreaterThan(1);
    expect(Math.max(...stratified) - Math.min(...stratified)).toBeLessThanOrEqual(1);
    expect(evaluationData.metadata.seed).toBe(42);
    expect(evaluationData.metadata.versions.sklearn).toMatch(/^\d+\./);
  });
});
