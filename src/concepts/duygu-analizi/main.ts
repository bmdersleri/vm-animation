import '../../core/theme.css';
import './duygu-analizi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { duyguAnaliziScenario, type SentimentParams } from './scenario';

const duyguAnaliziPage: ConceptPage<SentimentParams> = {
  title: 'Duygu analizi: TF-IDF ve lojistik regresyon',
  chapter: 'Bölüm ? · …',
  scenario: duyguAnaliziScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, duyguAnaliziPage);
