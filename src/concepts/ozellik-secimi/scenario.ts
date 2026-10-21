import type { Scenario } from '../../core/player';

export type OzellikSecimiParams = Record<string, never>;

export const ozellikSecimiScenario: Scenario<OzellikSecimiParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'Özellik seçimi: filtre ve sarmalayıcı',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
