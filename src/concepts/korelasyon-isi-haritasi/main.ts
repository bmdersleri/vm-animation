import '../../core/theme.css';
import './korelasyon-isi-haritasi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { korelasyonScenario, korelasyonShortcuts, type KorelParams } from './scenario';
import { mountKorelasyonScene } from './scene';
import { mountKorelasyonParams } from './controls';
import { mountKorelasyonExtra } from './extra';

export const korelasyonIsiHaritasiPage: ConceptPage<KorelParams> = {
  title: 'Korelasyon, ısı haritası ve Anscombe Dörtlüsü',
  chapter: 'Bölüm 2 · Betimsel İstatistikler',
  scenario: korelasyonScenario,
  mountScene: (el, player, mode) => mountKorelasyonScene(el, player, mode),
  mountParams: mountKorelasyonParams,
  mountExplainExtra: mountKorelasyonExtra,
  shortcuts: korelasyonShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, korelasyonIsiHaritasiPage);
