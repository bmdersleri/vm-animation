import '../../core/theme.css';
import './lime-yerel.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { limeYerelScenario, type LimeParams } from './scenario';
import { mountLimeScene } from './scene';

const limeYerelPage: ConceptPage<LimeParams> = {
  title: 'LIME: yerel vekil model ve SHAP ile karşılaştırma',
  chapter: 'Bölüm 13 · Açıklanabilir yapay zekâ',
  scenario: limeYerelScenario,
  mountScene: mountLimeScene,
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, limeYerelPage);
}
