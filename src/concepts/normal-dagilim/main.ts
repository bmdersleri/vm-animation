import '../../core/theme.css';
import './normal-dagilim.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { normalDagilimScenario, normalShortcuts, type NormalDagilimParams } from './scenario';
import { mountNormalParams } from './controls';
import { mountNormalExtra } from './extra';

import { mountNormalScene } from './scene';

const normalDagilimPage: ConceptPage<NormalDagilimParams> = {
  title: 'Normal dağılım ve standart sapma',
  chapter: 'Bölüm 2 · Keşifsel veri analizi',
  scenario: normalDagilimScenario,
  mountScene: mountNormalScene,
  mountParams: mountNormalParams,
  mountExplainExtra: mountNormalExtra,
  shortcuts: normalShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, normalDagilimPage);
