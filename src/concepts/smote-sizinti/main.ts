import '../../core/theme.css';
import './smote-sizinti.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { mountLeakParams } from './controls';
import { mountLeakExtra } from './extra';
import { smoteSizintiScenario, type LeakParams } from './scenario';
import { mountLeakScene } from './scene';

const smoteSizintiPage: ConceptPage<LeakParams> = {
  title: 'SMOTE sızıntısı ve PR-AUC',
  chapter: 'Bölüm 11 · Dengesiz veri ve tuzaklar',
  scenario: smoteSizintiScenario,
  mountScene: mountLeakScene,
  mountParams: mountLeakParams,
  mountExplainExtra: mountLeakExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, smoteSizintiPage);
