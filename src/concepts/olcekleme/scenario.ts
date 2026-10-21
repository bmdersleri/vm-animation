import type { Scenario } from '../../core/player';

export type OlceklemeParams = Record<string, never>;

export const olceklemeScenario: Scenario<OlceklemeParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'Ölçekleme ve veri sızıntısı',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
