import '../../core/theme.css';
import './iqr-aykiri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { iqrAykiriScenario, type IqrParams } from './scenario';

const iqrAykiriPage: ConceptPage<IqrParams> = {
  title: 'Eksik veri ve IQR ile aykırı değer',
  chapter: 'Bölüm ? · …',
  scenario: iqrAykiriScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, iqrAykiriPage);
