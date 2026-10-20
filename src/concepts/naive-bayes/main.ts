import '../../core/theme.css';
import './naive-bayes.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { naiveBayesScenario, type NaiveBayesParams } from './scenario';

const naiveBayesPage: ConceptPage<NaiveBayesParams> = {
  title: 'Naive Bayes',
  chapter: 'Bölüm ? · …',
  scenario: naiveBayesScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, naiveBayesPage);
