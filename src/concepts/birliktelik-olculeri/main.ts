import '../../core/theme.css';
import './birliktelik-olculeri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { birliktelikOlculeriScenario, type BirliktelikOlculeriParams } from './scenario';
import { mountBirliktelikOlculeriScene } from './scene';

export const birliktelikOlculeriPage: ConceptPage<BirliktelikOlculeriParams> = {
  title: 'Destek, güven ve kaldıraç',
  chapter: 'Bölüm 8 · Birliktelik Kuralı Madenciliği',
  scenario: birliktelikOlculeriScenario,
  mountScene: mountBirliktelikOlculeriScene,
  // The Lab controls (rule picker, basket editing, thresholds) come in a later task.
  mountParams: () => {},
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, birliktelikOlculeriPage);
