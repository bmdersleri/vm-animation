import '../../core/theme.css';
import './crisp-dm.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { mountCrispParams } from './controls';
import { crispDmScenario, type CrispParams } from './scenario';
import { mountCrispScene } from './scene';

const crispDmPage: ConceptPage<CrispParams> = {
  title: 'CRISP-DM döngüsü: altı evre ve geri dönüşler',
  chapter: 'Bölüm 1 · Giriş ve CRISP-DM',
  scenario: crispDmScenario,
  mountScene: mountCrispScene,
  mountParams: mountCrispParams,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, crispDmPage);
}
