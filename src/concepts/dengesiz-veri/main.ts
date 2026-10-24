import '../../core/theme.css';
import './dengesiz-veri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { dengesizVeriScenario, type ImbParams } from './scenario';
import { mountImbParams } from './controls';
import { mountImbExtra } from './extra';
import { mountImbScene } from './scene';

const dengesizVeriPage: ConceptPage<ImbParams> = {
  title: 'Dengesiz veri: doğruluk tuzağı, SMOTE ve sınıf ağırlığı',
  chapter: 'Bölüm 11 · Dengesiz veri ve tuzaklar',
  scenario: dengesizVeriScenario,
  mountScene: mountImbScene,
  mountParams: mountImbParams,
  mountExplainExtra: mountImbExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, dengesizVeriPage);
