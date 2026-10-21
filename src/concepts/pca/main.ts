import '../../core/theme.css';
import './pca.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { pcaScenario, type PcaParams } from './scenario';

const pcaPage: ConceptPage<PcaParams> = {
  title: 'PCA ve t-SNE ile boyut indirgeme',
  chapter: 'Bölüm ? · …',
  scenario: pcaScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, pcaPage);
