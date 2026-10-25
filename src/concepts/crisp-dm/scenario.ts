import type { Scenario } from '../../core/player';

export type CrispDmParams = Record<string, never>;

export const crispDmScenario: Scenario<CrispDmParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'CRISP-DM döngüsü: altı evre ve geri dönüşler',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
