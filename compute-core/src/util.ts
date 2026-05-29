/** Округление до 2 знаков — гасит float-шум в количествах и ценах. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
