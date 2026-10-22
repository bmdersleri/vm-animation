import '../../core/theme.css';
import './capraz-dogrulama.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { cvScenario, type CvParams } from './scenario';
import { mountCvScene } from './scene';
import { mountCvParams } from './controls';

export const cvPage: ConceptPage<CvParams> = {
  title: 'Çapraz doğrulama ve veri sızıntısı',
  chapter: 'Bölüm 6 · Model değerlendirme ve metrikler',
  scenario: cvScenario,
  mountScene: mountCvScene,
  mountParams: mountCvParams,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, cvPage);
