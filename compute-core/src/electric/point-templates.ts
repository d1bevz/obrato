import type { RoomType } from '../types.ts';

export interface ElectricPoints {
  sockets: number;
  switches: number;
  lights: number;
}

/**
 * MVP-электрика = ТОЛЬКО позиции точек по шаблону на тип комнаты + ручная правка.
 * Без расчёта трасс кабеля (design.md, MVP scope п.2).
 *
 * Это же — общий паттерн всего ввода в Obrato: шаблон по типу комнаты
 * предзаполняет, прораб правит только дельту. Снимает конфликт "минимум ввода
 * vs геометрии нужно много чисел" (design.md, П3 + Open Question Q4).
 */
export const ELECTRIC_TEMPLATES: Record<RoomType, ElectricPoints> = {
  bathroom: { sockets: 1, switches: 1, lights: 2 },
  kitchen: { sockets: 6, switches: 2, lights: 3 },
  bedroom: { sockets: 4, switches: 2, lights: 1 },
  living: { sockets: 6, switches: 2, lights: 2 },
  hallway: { sockets: 1, switches: 2, lights: 2 },
  other: { sockets: 2, switches: 1, lights: 1 },
};

export function electricPointsFor(type: RoomType): ElectricPoints {
  return { ...ELECTRIC_TEMPLATES[type] };
}
