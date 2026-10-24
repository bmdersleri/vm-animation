import '../../core/theme.css';
import '../boosting/lr-color.css';
import './gradyan-artirma.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { gradyanArtirmaScenario, type GbParams } from './scenario';
import { mountGbParams } from './controls';
import { mountGbExtra } from './extra';
import { mountGbScene } from './scene';

const gradyanArtirmaPage: ConceptPage<GbParams> = {
  title: 'Gradyan artırma: artıklarla düzeltme',
  chapter: 'Bölüm 10 · Gradyan artırma',
  scenario: gradyanArtirmaScenario,
  mountScene: mountGbScene,
  mountParams: mountGbParams,
  mountExplainExtra: mountGbExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, gradyanArtirmaPage);
