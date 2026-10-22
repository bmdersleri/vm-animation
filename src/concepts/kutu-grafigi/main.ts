import '../../core/theme.css';
import './kutu-grafigi.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { kutuScenario, kutuShortcuts, type KutuParams } from './scenario';
import { mountKutuScene } from './scene';
import { mountKutuParams } from './controls';
import { mountKutuExtra } from './extra';

export const kutuGrafigiPage: ConceptPage<KutuParams> = {
  title: 'Kutu grafiği: çeyrekler ve aykırı değerler',
  chapter: 'Bölüm 2 · Keşifçi Veri Analizi (EDA)',
  scenario: kutuScenario,
  mountScene: (el, player, mode) => mountKutuScene(el, player, mode),
  mountParams: mountKutuParams,
  mountExplainExtra: mountKutuExtra,
  shortcuts: kutuShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) mountConceptPage(app, kutuGrafigiPage);
