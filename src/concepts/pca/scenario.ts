import type { Scenario } from '../../core/player';

export type PcaParams = Record<string, never>;

export const pcaScenario: Scenario<PcaParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'PCA ve t-SNE ile boyut indirgeme',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
