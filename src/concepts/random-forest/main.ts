import '../../core/theme.css';
import './random-forest.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { randomForestScenario, type RfParams } from './scenario';
import { mountRfScene } from './scene';

const randomForestPage: ConceptPage<RfParams> = {
  title: 'Random Forest, OOB ve öznitelik önemi',
  chapter: 'Bölüm 9 · Topluluk öğrenmesi',
  scenario: randomForestScenario,
  mountScene: mountRfScene,
  // the Lab controls come with the Lab task
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, randomForestPage);
