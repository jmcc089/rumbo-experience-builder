export const MARKUP_RATE = 0.30;

export const applyMarkup = (net: number): number =>
  Math.round(net * (1 + MARKUP_RATE) * 100) / 100;
