import '../../core/theme.css';
import './bagging.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { baggingScenario, type BaggingParams } from './scenario';
import { mountBaggingScene } from './scene';

const baggingPage: ConceptPage<BaggingParams> = {
  title: 'Bootstrap ve bagging',
  chapter: 'Bölüm 9 · Topluluk öğrenmesi',
  scenario: baggingScenario,
  mountScene: mountBaggingScene,
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, baggingPage);
