import '../../core/theme.css';
import '../boosting/lr-color.css';
import './boosting-ayarlari.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { boostingAyarlariScenario, type TuneParams } from './scenario';
import { mountTuneScene } from './scene';
import { mountTuneParams } from './controls';
import { mountTuneExtra } from './extra';

const boostingAyarlariPage: ConceptPage<TuneParams> = {
  title: 'Boosting ayarları: öğrenme oranı, erken durdurma, arama',
  chapter: 'Bölüm 10 · Gradyan artırma',
  scenario: boostingAyarlariScenario,
  mountScene: mountTuneScene,
  mountParams: mountTuneParams,
  mountExplainExtra: mountTuneExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, boostingAyarlariPage);
