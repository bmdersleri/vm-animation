import '../../core/theme.css';
import './dagilim-carpiklik.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { dagilimScenario, type DagilimParams } from './scenario';

const dagilimCarpiklikPage: ConceptPage<DagilimParams> = {
  title: 'Dağılım, ortalama–medyan ve çarpıklık',
  chapter: 'Bölüm ? · …',
  scenario: dagilimScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, dagilimCarpiklikPage);
