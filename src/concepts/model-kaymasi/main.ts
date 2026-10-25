import '../../core/theme.css';
import './model-kaymasi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { modelKaymasiScenario, type KaymaParams } from './scenario';

const modelKaymasiPage: ConceptPage<KaymaParams> = {
  title: 'Model kayması ve izleme eşiği',
  chapter: 'Bölüm 14 · Büyük veri, MLOps ve etik',
  scenario: modelKaymasiScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, modelKaymasiPage);
