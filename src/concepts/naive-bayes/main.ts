import '../../core/theme.css';
import './naive-bayes.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { nbScenario, type NbParams } from './scenario';

const naiveBayesPage: ConceptPage<NbParams> = {
  title: 'Naive Bayes',
  chapter: 'Bölüm ? · …',
  scenario: nbScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, naiveBayesPage);
