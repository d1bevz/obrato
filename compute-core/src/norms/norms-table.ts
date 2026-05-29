import type { MaterialKind, NormAssumptions, Unit } from '../types.ts';

export interface NormRule {
  material: MaterialKind;
  /** Расход материала на 1 единицу ведущей меры (площадь м² или длина пог.м). */
  perUnit: number;
  unit: Unit;
  assumptions: NormAssumptions;
}

/**
 * ⚠️⚠️ СТАРТОВЫЕ КОЭФФИЦИЕНТЫ-ЗАГЛУШКИ. НЕ ВАЛИДИРОВАНЫ. ⚠️⚠️
 *
 * Это Risk #1 из design.md — то, от чего зависит, работает продукт или нет.
 * Норма — это число + ДОПУЩЕНИЯ, и часть реальных входов (зубец шпателя, паттерн
 * раскладки, ровность основания) в модели ввода Д×Ш×В ОТСУТСТВУЕТ — они зашиты
 * сюда как допущения. Калибруются по фактической закупке Давида на первых
 * реальных объектах (concierge-сверка). НЕ доверять вслепую.
 */
export const STARTER_NORMS: Record<MaterialKind, NormRule> = {
  'floor-tile': {
    material: 'floor-tile', perUnit: 1, unit: 'm2',
    assumptions: { wasteFactor: 0.1, notes: ['прямая раскладка ~10% подрезки; диагональ ~15%+', 'прямоугольная комната'] },
  },
  'wall-tile': {
    material: 'wall-tile', perUnit: 1, unit: 'm2',
    assumptions: { wasteFactor: 0.1, notes: ['прямая раскладка ~10%', 'без сложных обходов сантехники'] },
  },
  'tile-adhesive': {
    material: 'tile-adhesive', perUnit: 4, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['ДОПУЩЕНИЕ: зубец 8 мм + плитка среднего формата (кг/м² сильно зависит от обоих)', 'ровное основание'] },
  },
  'grout': {
    material: 'grout', perUnit: 0.5, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['ДОПУЩЕНИЕ: шов 2 мм, плитка среднего формата, толщина 8 мм'] },
  },
  'paint': {
    material: 'paint', perUnit: 0.25, unit: 'l',
    assumptions: { wasteFactor: 0.05, notes: ['2 слоя', 'ДОПУЩЕНИЕ: впитываемость основания средняя'] },
  },
  'primer': {
    material: 'primer', perUnit: 0.12, unit: 'l',
    assumptions: { wasteFactor: 0.05, notes: ['1 слой грунта'] },
  },
  'screed-mix': {
    material: 'screed-mix', perUnit: 20, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['⚠️ ДОПУЩЕНИЕ: толщина ~1.5 см. Реально расход = f(ровность основания), которая НЕ выводится из Д×Ш×В — кандидат №1 на провал, см. Risk #1'] },
  },
  'waterproofing': {
    material: 'waterproofing', perUnit: 1.5, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['обмазочная, 2 слоя', 'только мокрые зоны'] },
  },
  'baseboard': {
    material: 'baseboard', perUnit: 1, unit: 'm',
    assumptions: { wasteFactor: 0.05, notes: ['ДОПУЩЕНИЕ: ширина дверных проёмов из периметра не вычтена'] },
  },
};
