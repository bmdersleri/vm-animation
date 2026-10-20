// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readMode, writeMode } from '../../src/core/mode';

describe('mode', () => {
  it('readMode ders', () => expect(readMode('?mod=ders')).toBe('ders'));
  it('readMode empty -> lab', () => expect(readMode('')).toBe('lab'));
  it('readMode unknown -> lab', () => expect(readMode('?mod=x')).toBe('lab'));
  it('writeMode keeps other params, path and hash', () => {
    history.replaceState(null, '', '/sayfa?a=1#bolum');
    writeMode('ders');
    expect(location.pathname).toBe('/sayfa');
    expect(location.search).toBe('?a=1&mod=ders');
    expect(location.hash).toBe('#bolum');
    writeMode('lab');
    expect(readMode(location.search)).toBe('lab');
    expect(location.search).toContain('a=1');
  });
});
