import '../../core/theme.css';
import './random-forest.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { randomForestScenario, type RfParams } from './scenario';
import { mountRfParams } from './controls';
import { mountRfExtra } from './extra';
import { mountRfScene } from './scene';

const randomForestPage: ConceptPage<RfParams> = {
  title: 'Random Forest, OOB ve öznitelik önemi',
  chapter: 'Bölüm 9 · Topluluk öğrenmesi',
  scenario: randomForestScenario,
  mountScene: mountRfScene,
  mountParams: mountRfParams,
  mountExplainExtra: mountRfExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, randomForestPage);
