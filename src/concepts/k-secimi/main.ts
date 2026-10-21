import '../../core/theme.css';
import './k-secimi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { kSecimiScenario, type KSecimiParams } from './scenario';
import { mountKSecimiScene } from './scene';

export const kSecimiPage: ConceptPage<KSecimiParams> = {
  title: 'k sayısının seçimi',
  chapter: 'Bölüm 7 · Kümeleme Analizi',
  scenario: kSecimiScenario,
  mountScene: mountKSecimiScene,
  // Lab controls (k slider, point picker) arrive in the next task.
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kSecimiPage);
