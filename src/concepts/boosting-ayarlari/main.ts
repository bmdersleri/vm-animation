import '../../core/theme.css';
import './boosting-ayarlari.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { boostingAyarlariScenario, type TuneParams } from './scenario';
import { mountTuneScene } from './scene';

const boostingAyarlariPage: ConceptPage<TuneParams> = {
  title: 'Boosting ayarları: öğrenme oranı, erken durdurma, arama',
  chapter: 'Bölüm 10 · Gradyan artırma',
  scenario: boostingAyarlariScenario,
  mountScene: mountTuneScene,
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, boostingAyarlariPage);
