import '../../core/theme.css';
import './normal-dagilim.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { normalDagilimScenario, type NormalDagilimParams } from './scenario';

const normalDagilimPage: ConceptPage<NormalDagilimParams> = {
  title: 'Normal dağılım ve standart sapma',
  chapter: 'Bölüm ? · …',
  scenario: normalDagilimScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, normalDagilimPage);
