import type { Scenario } from '../../core/player';

export type IqrAykiriParams = Record<string, never>;

export const iqrAykiriScenario: Scenario<IqrAykiriParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'Eksik veri ve IQR ile aykırı değer',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
