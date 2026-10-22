import '../../core/theme.css';
import './korelasyon-isi-haritasi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { korelasyonScenario, korelasyonShortcuts, type KorelParams } from './scenario';

/** Scaffold: Task 7 mounts the scene, the controls and the Lab panel. */
export const korelasyonIsiHaritasiPage: ConceptPage<KorelParams> = {
  title: 'Korelasyon, ısı haritası ve Anscombe Dörtlüsü',
  chapter: 'Bölüm 2 · Betimsel İstatistikler',
  scenario: korelasyonScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
  shortcuts: korelasyonShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, korelasyonIsiHaritasiPage);
