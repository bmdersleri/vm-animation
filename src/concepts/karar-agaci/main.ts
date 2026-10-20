import '../../core/theme.css';
import './karar-agaci.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { kararAgaciScenario, type KararAgaciParams } from './scenario';

const kararAgaciPage: ConceptPage<KararAgaciParams> = {
  title: 'Karar Ağacı',
  chapter: 'Bölüm ? · …',
  scenario: kararAgaciScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kararAgaciPage);
