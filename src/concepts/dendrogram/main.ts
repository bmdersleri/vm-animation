import '../../core/theme.css';
import './dendrogram.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { dendrogramScenario, type DendrogramParams } from './scenario';
import { mountDendrogramParams } from './controls';
import { mountDendrogramScene } from './scene';

export const dendrogramPage: ConceptPage<DendrogramParams> = {
  title: 'Hiyerarşik kümeleme ve dendrogram',
  chapter: 'Bölüm 7 · Kümeleme Analizi',
  scenario: dendrogramScenario,
  mountScene: mountDendrogramScene,
  mountParams: mountDendrogramParams,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, dendrogramPage);
