/**
 * Сырое количество -> целое число товарных упаковок (всегда вверх).
 * Округление взаимодействует с коэффициентом отхода (он уже в rawQuantity) —
 * это часть ядра, не "потом" (см. design.md, MVP scope п.4).
 */
export function packsNeeded(rawQuantity: number, packSize: number): number {
  if (packSize <= 0) throw new Error(`packSize должен быть > 0, получено ${packSize}`);
  if (rawQuantity <= 0) return 0;
  return Math.ceil(rawQuantity / packSize);
}
