"""Generate deterministic normal-distribution teaching samples and full-precision fixtures.

Run ``python scripts/make_normal_data.py``; use ``--check`` to reject drift.
Search seeds from zero, selecting the first acceptable sample independently:
sinav = rounded/clipped normal(70, 10, 200), mean 69.5..70.5, sample
std 9.5..10.5, |pandas skew| < .2, inclusive 1/2/3-sigma fractions
.65...71 / .93...97 / >= .99. cagri = rounded lognormal(1.3, .6, 200),
skew > 1, mean > median, inclusive one-sigma fraction >= .75.
Histogram edges are 30..110 by 5 for sinav; 0..first integer strictly above
the maximum by 1 for cagri. Statistics use pandas ddof 1; scaled fixtures
use sklearn StandardScaler and ddof 0. scipy supplies PDF/CDF reference values.
JSON float repr preserves precision; repeated runs are byte-identical.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import norm
from sklearn.preprocessing import StandardScaler

OUT = Path(__file__).resolve().parent.parent / 'src/concepts/normal-dagilim/data/normal_data.json'


def acceptable(s: pd.Series, kind: str) -> bool:
    m, sd = float(s.mean()), float(s.std())
    fractions = [float(s.between(m - k * sd, m + k * sd).mean()) for k in (1, 2, 3)]
    if kind == 'sinav':
        return (69.5 <= m <= 70.5 and 9.5 <= sd <= 10.5 and abs(s.skew()) < .2
                and .65 <= fractions[0] <= .71 and .93 <= fractions[1] <= .97 and fractions[2] >= .99)
    return bool(s.skew() > 1 and m > s.median() and fractions[0] >= .75)


def series(kind: str) -> dict:
    for seed in range(100_000):
        rng = np.random.default_rng(seed)
        values = (np.clip(np.rint(rng.normal(70, 10, 200)), 0, 100)
                  if kind == 'sinav' else np.round(rng.lognormal(1.3, .6, 200), 1))
        s = pd.Series(values)
        if acceptable(s, kind):
            break
    else:
        raise ValueError(f'No acceptable seed for {kind}')
    if not acceptable(s, kind):
        raise ValueError(f'Sample constraints failed for {kind}')
    lo, hi, width = (30, 110, 5) if kind == 'sinav' else (0, math.floor(float(s.max())) + 1, 1)
    edges = np.arange(lo, hi + width, width)
    counts, _ = np.histogram(values, bins=edges)
    if int(counts.sum()) != len(s):
        raise ValueError(f'Histogram loses observations for {kind}')
    scaled = pd.Series(StandardScaler().fit_transform(values.reshape(-1, 1)).ravel())
    m, sd = float(s.mean()), float(s.std())
    return {
        'id': kind, 'label': 'Sınav notu' if kind == 'sinav' else 'Çağrı süresi',
        'unit': 'puan' if kind == 'sinav' else 'dakika',
        'values': values.astype(int).tolist() if kind == 'sinav' else values.tolist(),
        'domain': [lo, hi], 'binWidth': width, 'edges': edges.tolist(), 'counts': counts.tolist(),
        'mean': m, 'std': sd, 'median': float(s.median()), 'skew': float(s.skew()),
        'band': [{'k': k, 'lo': m - k * sd, 'hi': m + k * sd,
                  'count': int(s.between(m - k * sd, m + k * sd).sum())} for k in (1, 2, 3)],
        'scaled': {'mean': float(scaled.mean()), 'std0': float(scaled.std(ddof=0)), 'skew': float(scaled.skew())},
        'seed': seed,
    }


def generate() -> dict:
    samples = {key: series(key) for key in ('sinav', 'cagri')}
    points = []
    for mu, sigma in [(0, 1), (70, 10), (4, .3), *[(s['mean'], s['std']) for s in samples.values()]]:
        for z in [-10, -8, -6, -3, -2, -1, -.5, -.01, 0, .01, .5, 1, 2, 3, 6, 8, 10]:
            x = mu + z * sigma
            points.append({'x': x, 'mu': mu, 'sigma': sigma,
                           'pdf': float(norm.pdf(x, loc=mu, scale=sigma)),
                           'cdf': float(norm.cdf(x, loc=mu, scale=sigma))})
    s = samples['sinav']
    m, sd = s['mean'], s['std']
    z = (85 - m) / sd
    return {'series': samples, 'norm': {
        'bands': [[k, float(norm.cdf(k) - norm.cdf(-k))] for k in (1, 2, 3)], 'points': points},
        'sinavFixed': {'a': 60, 'b': 80, 'area': float(norm.cdf(80, m, sd) - norm.cdf(60, m, sd)),
                       'count': sum(60 <= x <= 80 for x in s['values']), 'x': 85,
                       'z': z, 'phi': float(norm.cdf(z))}}


def main() -> None:
    if any(arg != '--check' for arg in sys.argv[1:]):
        raise ValueError('Usage: make_normal_data.py [--check]')
    content = json.dumps(generate(), ensure_ascii=False, indent=2, allow_nan=False) + '\n'
    if '--check' in sys.argv:
        if not OUT.exists() or OUT.read_bytes() != content.encode('utf-8'):
            raise ValueError(f'Fixture drift: regenerate {OUT}')
        print('Normal data fixture matches (--check).')
    else:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_bytes(content.encode('utf-8'))
        print(f'Wrote {OUT}')


if __name__ == '__main__':
    try:
        main()
    except ValueError as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
