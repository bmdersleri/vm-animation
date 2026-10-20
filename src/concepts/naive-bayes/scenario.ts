import type { Scenario } from '../../core/player';

export type NaiveBayesParams = Record<string, never>;

export const naiveBayesScenario: Scenario<NaiveBayesParams> = {
  defaults: {},
  steps: [
    {
      id: 'giris',
      title: 'Naive Bayes',
      text: 'Bu sayfa henüz hazırlanıyor.',
    },
  ],
};
