import type { Scenario } from '../../core/player';

export type NormalDagilimParams = Record<string, never>;

export const normalDagilimScenario: Scenario<NormalDagilimParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'Normal dağılım ve standart sapma',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
