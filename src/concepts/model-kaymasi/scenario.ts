import type { Scenario } from '../../core/player';

export type ModelKaymasiParams = Record<string, never>;

export const modelKaymasiScenario: Scenario<ModelKaymasiParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'Model kayması ve izleme eşiği',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
