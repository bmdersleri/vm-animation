import '../../core/theme.css';
import './dagilim-carpiklik.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { dagilimScenario, dagilimShortcuts, type DagilimParams } from './scenario';
import { mountDagilimScene } from './scene';
import { mountDagilimParams } from './controls';
import { mountDagilimExtra } from './extra';

export const dagilimCarpiklikPage: ConceptPage<DagilimParams> = {
  title: 'Dağılım, ortalama–medyan ve çarpıklık',
  chapter: 'Bölüm 2 · Keşifçi Veri Analizi (EDA)',
  scenario: dagilimScenario,
  mountScene: (el, player, mode) => mountDagilimScene(el, player, mode),
  mountParams: mountDagilimParams,
  mountExplainExtra: mountDagilimExtra,
  shortcuts: dagilimShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, dagilimCarpiklikPage);
