import '../../core/theme.css';
import './shap-degerleri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { shapDegerleriScenario, type ShapParams } from './scenario';
import { mountShapScene } from './scene';

const shapDegerleriPage: ConceptPage<ShapParams> = {
  title: 'SHAP: Shapley değerleriyle katkı',
  chapter: 'Bölüm 13 · Açıklanabilir yapay zekâ',
  scenario: shapDegerleriScenario,
  mountScene: mountShapScene,
  // the Lab controls come with the controls task
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, shapDegerleriPage);
}
