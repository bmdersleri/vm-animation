import '../../core/theme.css';
import './karar-agaci.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { treeScenario, type TreeParams } from './scenario';

const kararAgaciPage: ConceptPage<TreeParams> = {
  title: 'Karar Ağacı',
  chapter: 'Bölüm ? · …',
  scenario: treeScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kararAgaciPage);
