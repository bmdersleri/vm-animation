import '../../core/theme.css';
import './bagging.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { baggingScenario, type BaggingParams } from './scenario';

const baggingPage: ConceptPage<BaggingParams> = {
  title: 'Bootstrap ve bagging',
  chapter: 'Bölüm ? · …',
  scenario: baggingScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, baggingPage);
