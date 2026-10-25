import '../../core/theme.css';
import './crisp-dm.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { crispDmScenario, type CrispParams } from './scenario';

const crispDmPage: ConceptPage<CrispParams> = {
  title: 'CRISP-DM döngüsü: altı evre ve geri dönüşler',
  chapter: 'Bölüm 1 · Giriş ve CRISP-DM',
  scenario: crispDmScenario,
  mountScene: () => ({ resize() {}, setMode() {}, destroy() {} }),
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, crispDmPage);
