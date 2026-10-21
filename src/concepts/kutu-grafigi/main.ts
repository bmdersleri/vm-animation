import '../../core/theme.css';
import './kutu-grafigi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { kutuScenario, kutuShortcuts, type KutuParams } from './scenario';

export const kutuGrafigiPage: ConceptPage<KutuParams> = {
  title: 'Kutu grafiği: çeyrekler ve aykırı değerler',
  chapter: 'Bölüm 2 · Betimsel İstatistikler',
  scenario: kutuScenario,
  // Task 5 replaces the stub with the box-plot scene and the params card.
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
  shortcuts: kutuShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kutuGrafigiPage);
