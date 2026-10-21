import '../../core/theme.css';
import './iqr-aykiri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { iqrAykiriScenario, type IqrAykiriParams } from './scenario';

const iqrAykiriPage: ConceptPage<IqrAykiriParams> = {
  title: 'Eksik veri ve IQR ile aykırı değer',
  chapter: 'Bölüm ? · …',
  scenario: iqrAykiriScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, iqrAykiriPage);
