import { describe, it, expect } from 'vitest';
import fixture from '../../fixtures/topluluk_sklearn.json';
import { CUSTOMERS } from '../../../src/concepts/topluluk/data';
import { majority, oobScore, oobVotes, voteFill, votes } from '../../../src/concepts/topluluk/vote';

describe('topluluk vote', () => {
  it('vote counts match the fixture for every m', () => {
    for (let i = 0; i < CUSTOMERS.length; i++) {
      for (let m = 1; m <= 50; m++) {
        const got = votes([CUSTOMERS[i].t, CUSTOMERS[i].c], m);
        expect(got, `customer ${i} m ${m}`).toBe(fixture.votes[i][m - 1]);
      }
    }
  });

  it('grid votes match the fixture and voteFill paints the vote share', () => {
    const { cols, rows, xs, ys, pred } = fixture.grid;
    const share = (cell: number, m: number): number => {
      let sum = 0;
      for (let k = 0; k < m; k++) {
        sum += pred[k][cell];
      }
      return sum;
    };
    for (let r = 0; r < rows; r += 5) {
      for (let c = 0; c < cols; c += 5) {
        expect(votes([xs[c], ys[r]], 50)).toBe(share(r * cols + c, 50));
      }
    }
    const sc = {
      x: Object.assign((v: number) => v, { domain: () => [0, 60] }),
      y: Object.assign((v: number) => v, { domain: () => [-0.5, 5.5] }),
    };
    for (const m of [1, 7, 50]) {
      const out = new Uint8Array(cols * rows);
      voteFill(m, sc as never)({ cols, rows }, out);
      for (let i = 0; i < out.length; i++) {
        expect(out[i], `m ${m} cell ${i}`).toBe(Math.round((10 * share(i, m)) / m));
      }
    }
  });

  it('majority breaks ties to kaldi', () => {
    expect(majority(2, 4)).toBe(0);
    expect(majority(3, 4)).toBe(1);
    expect(majority(25, 50)).toBe(0);
    expect(majority(26, 50)).toBe(1);
    expect(majority(1, 1)).toBe(1);
    expect(majority(0, 1)).toBe(0);
  });

  it('oob votes and score match the fixture', () => {
    for (let i = 0; i < CUSTOMERS.length; i++) {
      for (let m = 1; m <= 50; m++) {
        const got = oobVotes(i, m);
        expect(got.ayrildi, `ayrildi ${i} ${m}`).toBe(fixture.oobAyrildi[i][m - 1]);
        expect(got.kaldi, `kaldi ${i} ${m}`).toBe(fixture.oobKaldi[i][m - 1]);
      }
    }
    for (let m = 1; m <= 50; m++) {
      expect(oobScore(m), `score ${m}`).toEqual(fixture.oobScore[m - 1]);
    }
  });

  it('customers without oob votes leave the denominator', () => {
    const first = oobScore(1);
    expect(first.total).toBeLessThan(CUSTOMERS.length);
    let silent = 0;
    for (let i = 0; i < CUSTOMERS.length; i++) {
      const v = oobVotes(i, 1);
      if (v.ayrildi + v.kaldi === 0) {
        silent++;
      }
    }
    expect(silent + first.total).toBe(CUSTOMERS.length);
  });
});
