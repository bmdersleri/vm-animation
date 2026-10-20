export type Mode = 'ders' | 'lab';

export function readMode(search: string): Mode {
  return new URLSearchParams(search).get('mod') === 'ders' ? 'ders' : 'lab';
}

export function writeMode(mode: Mode): void {
  const url = new URL(location.href);
  url.searchParams.set('mod', mode);
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
