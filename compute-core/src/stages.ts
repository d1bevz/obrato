import type { Stage } from './types.ts';
import { STAGES } from './types.ts';

/** Человекочитаемые подписи этапов (для PDF и UI). */
export const STAGE_LABELS: Record<Stage, string> = {
  'demolition': 'Демонтаж',
  'rough-plumbing-electric': 'Черновая сантехника + электрика',
  'screed': 'Стяжка / выравнивание пола',
  'waterproofing': 'Гидроизоляция мокрых зон',
  'tiling': 'Плиточные работы',
  'wall-ceiling-finish': 'Отделка стен / потолков (краска)',
  'flooring': 'Напольные покрытия',
  'final': 'Чистовая (сантехника, электроустановка, двери, мебель)',
};

/** Порядковый индекс этапа в каноническом порядке стройки. */
export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}
