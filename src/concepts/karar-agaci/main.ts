import '../../core/theme.css';
import './karar-agaci.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { treeScenario, treeShortcuts, type TreeParams } from './scenario';
import { mountTreeScene } from './scene';

const kararAgaciPage: ConceptPage<TreeParams> = {
  title: 'Karar Ağacı',
  chapter: 'Bölüm ? · …',
  scenario: treeScenario,
  mountScene: (el, player, mode) => mountTreeScene(el, player, mode),
  mountParams: () => {},
  shortcuts: treeShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kararAgaciPage);
