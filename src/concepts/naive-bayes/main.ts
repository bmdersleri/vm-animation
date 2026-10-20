import '../../core/theme.css';
import './naive-bayes.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { nbScenario, nbShortcuts, type NbParams } from './scenario';
import { mountNbScene } from './scene';

const naiveBayesPage: ConceptPage<NbParams> = {
  title: 'Naive Bayes',
  chapter: 'Bölüm 5 · Sınıflandırmaya Giriş',
  scenario: nbScenario,
  mountScene: (el, player, mode) => mountNbScene(el, player, mode),
  mountParams: () => {},
  shortcuts: nbShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, naiveBayesPage);
