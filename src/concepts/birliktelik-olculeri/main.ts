import '../../core/theme.css';
import './birliktelik-olculeri.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { birliktelikOlculeriScenario, type BirliktelikOlculeriParams } from './scenario';
import { mountBirliktelikOlculeriParams } from './controls';
import { mountBirliktelikOlculeriScene } from './scene';

export const birliktelikOlculeriPage: ConceptPage<BirliktelikOlculeriParams> = {
  title: 'Destek, güven ve kaldıraç',
  chapter: 'Bölüm 8 · Birliktelik Kuralı Madenciliği',
  scenario: birliktelikOlculeriScenario,
  mountScene: mountBirliktelikOlculeriScene,
  mountParams: mountBirliktelikOlculeriParams,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, birliktelikOlculeriPage);
