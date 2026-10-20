import type { Scenario } from '../../core/player';

export type KararAgaciParams = Record<string, never>;

export const kararAgaciScenario: Scenario<KararAgaciParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'Karar Ağacı',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
