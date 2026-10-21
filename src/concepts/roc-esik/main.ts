import '../../core/theme.css';
import './roc-esik.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { rocScenario, type RocParams } from './scenario';
import { mountRocScene } from './scene';
import { mountRocParams } from './controls';
export const rocPage: ConceptPage<RocParams> = {
  title:'ROC, PR ve karar eşiği', chapter:'Bölüm 6 · Model değerlendirme ve metrikler',
  scenario:rocScenario,mountScene:mountRocScene,mountParams:mountRocParams,
};
const app=document.querySelector<HTMLElement>('#app');
if(app)mountConceptPage(app,rocPage);
