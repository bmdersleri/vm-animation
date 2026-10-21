import '../../core/theme.css';
import './iqr-aykiri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { iqrAykiriScenario, iqrShortcuts, type IqrParams } from './scenario';
import { mountIqrScene } from './scene';
import { mountIqrParams } from './controls';
import { mountIqrExtra } from './extra';

const iqrAykiriPage: ConceptPage<IqrParams> = {
  title: 'Eksik veri ve IQR ile aykırı değer',
  chapter: 'Bölüm 3 · Veri Ön İşleme',
  scenario: iqrAykiriScenario,
  mountScene: (el, player, mode) => mountIqrScene(el, player, mode),
  mountParams: mountIqrParams,
  mountExplainExtra: mountIqrExtra,
  shortcuts: iqrShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, iqrAykiriPage);
