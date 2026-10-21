import '../../core/theme.css';
import './olcekleme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { olceklemeScenario, type OlcParams } from './scenario';

const olceklemePage: ConceptPage<OlcParams> = {
  title: 'Ölçekleme ve veri sızıntısı',
  chapter: 'Bölüm ? · …',
  scenario: olceklemeScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, olceklemePage);
