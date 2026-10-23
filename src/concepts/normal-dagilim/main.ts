import '../../core/theme.css';
import './normal-dagilim.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { normalDagilimScenario, type NormalDagilimParams } from './scenario';

import { mountNormalScene } from './scene';

const normalDagilimPage: ConceptPage<NormalDagilimParams> = {
  title: 'Normal dağılım ve standart sapma',
  chapter: 'Bölüm 2 · Keşifsel veri analizi',
  scenario: normalDagilimScenario,
  mountScene: mountNormalScene,
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, normalDagilimPage);
