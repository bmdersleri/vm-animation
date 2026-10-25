import '../../core/theme.css';
import './duygu-analizi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { mountSentimentParams } from './controls';
import { mountSentimentExtra } from './extra';
import { duyguAnaliziScenario, type SentimentParams } from './scenario';
import { mountSentimentScene } from './scene';

const duyguAnaliziPage: ConceptPage<SentimentParams> = {
  title: 'Duygu analizi: TF-IDF ve lojistik regresyon',
  chapter: 'Bölüm 12 · Metin madenciliğine giriş',
  scenario: duyguAnaliziScenario,
  mountScene: mountSentimentScene,
  mountParams: mountSentimentParams,
  mountExplainExtra: mountSentimentExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, duyguAnaliziPage);
