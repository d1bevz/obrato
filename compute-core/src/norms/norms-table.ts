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
    material: 'tile-adhesive', perUnit: 3.5, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['seed гл.07 §1.1: 3.5 [2–8] kg/m²; расход = f(зубец гладилки, НЕ размера плитки)', 'ДОПУЩЕНИЕ: зубец 8 мм, одинарное нанесение, ровное основание'] },
  },
  'grout': {
    material: 'grout', perUnit: 0.3, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['seed гл.07 §1.2: 0.3 [0.04–2.9] kg/m² = пол 300×300, шов 3 мм', 'формула ((A+B)/(A×B))×C×D×k (k из фичи бренда, Mapei ≈1.6) здесь НЕ реализована — спецификация формул = гл.07'] },
  },
  'paint': {
    material: 'paint', perUnit: 0.17, unit: 'l',
    assumptions: { wasteFactor: 0.05, notes: ['seed гл.07 §1.5: 0.17 L/m² = 2 слоя при rendimento 12 m²/L [10–15]', 'ДОПУЩЕНИЕ: впитываемость основания средняя (меняет rendimento в разы)'] },
  },
  'primer': {
    material: 'primer', perUnit: 0.1, unit: 'l',
    assumptions: { wasteFactor: 0.05, notes: ['seed гл.07 §1.5: 0.10 L/m² = 1 слой при ~10 m²/L'] },
  },
  'floor-leveler': {
    material: 'floor-leveler', perUnit: 4.8, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['autonivelante, гл.07 §1.4 A: 1.6 [1.5–1.74] kg/м²/ММ × толщина_мм', '⚠️ ДОПУЩЕНИЕ: слой 3 мм зашит (4.8 = 1.6×3) — толщина = f(ровность основания), НЕ выводится из Д×Ш×В, Risk #1'] },
  },
  'screed-mix': {
    material: 'screed-mix', perUnit: 80, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['betonilha, гл.07 §1.4 B: ~20 kg/м²/СМ × толщина_см — ДРУГОЙ класс продукта, чем autonivelante (~10× расход на мм)', '⚠️ ДОПУЩЕНИЕ: слой 4 см зашит (80 = 20×4); выбор floor-leveler vs screed-mix = решение по основанию (Risk #1), прототип по умолчанию эмитит floor-leveler'] },
  },
  'waterproofing': {
    material: 'waterproofing', perUnit: 3.5, unit: 'kg',
    assumptions: { wasteFactor: 0.05, notes: ['seed гл.07 §1.3: 3.5 [3–4.2] kg/m², цементная обмазка, ≥2 слоя', '⚠️ площадь гидры = пол + периметр × заход (upstand, гл.07 §1.3) — прототип считает только пол мокрой зоны'] },
  },
  'baseboard': {
    material: 'baseboard', perUnit: 1, unit: 'm',
    assumptions: { wasteFactor: 0.05, notes: ['ДОПУЩЕНИЕ: ширина дверных проёмов из периметра не вычтена'] },
  },
};
