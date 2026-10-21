import '../../core/theme.css';
import './ozellik-secimi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { ozellikSecimiScenario, type SecimParams } from './scenario';

const ozellikSecimiPage: ConceptPage<SecimParams> = {
  title: 'Özellik seçimi: filtre ve sarmalayıcı',
  chapter: 'Bölüm ? · …',
  scenario: ozellikSecimiScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, ozellikSecimiPage);
