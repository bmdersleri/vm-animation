import '../../core/theme.css';
import './apriori.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { aprioriScenario, type AprioriParams } from './scenario';
import { mountAprioriParams } from './controls';
import { mountAprioriScene } from './scene';

export const aprioriPage: ConceptPage<AprioriParams> = {
  title: 'Apriori ve FP-Growth',
  chapter: 'Bölüm 8 · Birliktelik Kuralı Madenciliği',
  scenario: aprioriScenario,
  mountScene: mountAprioriScene,
  mountParams: mountAprioriParams,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, aprioriPage);
