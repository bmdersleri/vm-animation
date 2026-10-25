import '../../core/theme.css';
import './lime-yerel.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { mountLimeParams } from './controls';
import { mountLimeExtra } from './extra';
import { limeYerelScenario, type LimeParams } from './scenario';
import { mountLimeScene } from './scene';

const limeYerelPage: ConceptPage<LimeParams> = {
  title: 'LIME: yerel vekil model ve SHAP ile karşılaştırma',
  chapter: 'Bölüm 13 · Açıklanabilir yapay zekâ',
  scenario: limeYerelScenario,
  mountScene: mountLimeScene,
  mountParams: mountLimeParams,
  mountExplainExtra: mountLimeExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, limeYerelPage);
}
