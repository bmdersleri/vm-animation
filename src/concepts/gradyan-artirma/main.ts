import '../../core/theme.css';
import './gradyan-artirma.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { gradyanArtirmaScenario, type GbParams } from './scenario';
import { mountGbScene } from './scene';

const gradyanArtirmaPage: ConceptPage<GbParams> = {
  title: 'Gradyan artırma: artıklarla düzeltme',
  chapter: 'Bölüm 10 · Gradyan artırma',
  scenario: gradyanArtirmaScenario,
  mountScene: mountGbScene,
  // the Lab controls arrive with the page's controls task
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, gradyanArtirmaPage);
