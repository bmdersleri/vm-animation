import '../../core/theme.css';
import './dbscan.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { dbscanScenario, type DbscanParams } from './scenario';
import { mountDbscanParams } from './controls';
import { mountDbscanScene } from './scene';

export const dbscanPage: ConceptPage<DbscanParams> = {
  title: 'DBSCAN',
  chapter: 'Bölüm 7 · Kümeleme Analizi',
  scenario: dbscanScenario,
  mountScene: mountDbscanScene,
  mountParams: mountDbscanParams,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, dbscanPage);
