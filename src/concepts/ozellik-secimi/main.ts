import '../../core/theme.css';
import './ozellik-secimi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { ozellikSecimiScenario, secimShortcuts, type SecimParams } from './scenario';
import { mountSecimScene } from './scene';
import { mountSecimParams } from './controls';
import { mountSecimExtra } from './extra';

const ozellikSecimiPage: ConceptPage<SecimParams> = {
  title: 'Özellik seçimi: filtre ve sarmalayıcı',
  chapter: 'Bölüm 4 · Özellik Seçimi',
  scenario: ozellikSecimiScenario,
  mountScene: mountSecimScene,
  mountParams: mountSecimParams,
  mountExplainExtra: mountSecimExtra,
  shortcuts: secimShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, ozellikSecimiPage);
