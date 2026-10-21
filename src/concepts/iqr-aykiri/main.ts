import '../../core/theme.css';
import './iqr-aykiri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { iqrAykiriScenario, type IqrParams } from './scenario';
import { mountIqrScene } from './scene';

const iqrAykiriPage: ConceptPage<IqrParams> = {
  title: 'Eksik veri ve IQR ile aykırı değer',
  chapter: 'Bölüm ? · …',
  scenario: iqrAykiriScenario,
  mountScene: (el, player, mode) => mountIqrScene(el, player, mode),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, iqrAykiriPage);
