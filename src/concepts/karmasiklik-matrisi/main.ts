import '../../core/theme.css';
import './karmasiklik-matrisi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { matrixScenario, type MatrixParams } from './scenario';
import { mountMatrixScene } from './scene';
import { mountMatrixParams } from './controls';

export const matrixPage: ConceptPage<MatrixParams> = {
  title: 'Karmaşıklık matrisi ve metrikler',
  chapter: 'Bölüm 6 · Model değerlendirme ve metrikler',
  scenario: matrixScenario,
  mountScene: mountMatrixScene,
  mountParams: mountMatrixParams,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, matrixPage);
