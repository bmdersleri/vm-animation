import '../../core/theme.css';
import './k-means.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { kMeansScenario, type KMeansParams } from './scenario';
import { mountKMeansScene } from './scene';

export const kMeansPage: ConceptPage<KMeansParams> = {
  title: 'K-Means döngüsü',
  chapter: 'Bölüm 7 · Kümeleme Analizi',
  scenario: kMeansScenario,
  mountScene: mountKMeansScene,
  // Lab controls arrive with Task 4.
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kMeansPage);
