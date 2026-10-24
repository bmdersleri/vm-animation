import '../../core/theme.css';
import './tfidf-kosinus.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { tfidfKosinusScenario, type TfidfParams } from './scenario';
import { mountTfidfScene } from './scene';

const tfidfKosinusPage: ConceptPage<TfidfParams> = {
  title: 'TF-IDF ve kosinüs benzerliği',
  chapter: 'Bölüm 12 · Metin madenciliğine giriş',
  scenario: tfidfKosinusScenario,
  mountScene: mountTfidfScene,
  // the Lab controls come with the next task; Ders needs none
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, tfidfKosinusPage);
