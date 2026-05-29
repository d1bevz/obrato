import type { Room, MaterialRequirement, MaterialKind, Stage } from '../types.ts';
import { STARTER_NORMS } from './norms-table.ts';
import { round2 } from '../util.ts';

export function floorAreaM2(room: Room): number {
  return round2(room.lengthM * room.widthM);
}

export function ceilingAreaM2(room: Room): number {
  return round2(room.lengthM * room.widthM);
}

/** Площадь стен = периметр × высота − проёмы. */
export function wallAreaM2(room: Room): number {
  const perimeter = 2 * (room.lengthM + room.widthM);
  const gross = perimeter * room.heightM;
  const openings = room.openings.reduce((s, o) => s + o.widthM * o.heightM, 0);
  return round2(Math.max(0, gross - openings));
}

export function floorPerimeterM(room: Room): number {
  return round2(2 * (room.lengthM + room.widthM));
}

/** Применяет норму к ведущей мере (площадь или длина), отход уже включён в rawQuantity. */
function requirement(material: MaterialKind, roomId: string, drivingMeasure: number, stage: Stage): MaterialRequirement {
  const norm = STARTER_NORMS[material];
  const raw = drivingMeasure * norm.perUnit * (1 + norm.assumptions.wasteFactor);
  return { material, roomId, stage, rawQuantity: round2(raw), unit: norm.unit, assumptions: norm.assumptions };
}

/**
 * Состав работ (галочки по комнате) -> требования по материалам.
 * MVP: прямоугольные комнаты; мокрая зона -> плитка + гидроизоляция, сухая -> краска.
 * Электрика (точки) считается отдельно — см. electric/point-templates.ts.
 */
export function requirementsForRoom(room: Room): MaterialRequirement[] {
  const out: MaterialRequirement[] = [];
  const floor = floorAreaM2(room);
  const walls = wallAreaM2(room);
  const ceiling = ceilingAreaM2(room);
  const perim = floorPerimeterM(room);

  if (room.works.includes('floor')) {
    out.push(requirement('screed-mix', room.id, floor, 'screed'));
    if (room.wet) out.push(requirement('waterproofing', room.id, floor, 'waterproofing'));
    out.push(requirement('floor-tile', room.id, floor, 'tiling'));
    out.push(requirement('tile-adhesive', room.id, floor, 'tiling'));
    out.push(requirement('grout', room.id, floor, 'tiling'));
    if (!room.wet) out.push(requirement('baseboard', room.id, perim, 'final'));
  }

  if (room.works.includes('walls')) {
    if (room.wet) {
      out.push(requirement('wall-tile', room.id, walls, 'tiling'));
      out.push(requirement('tile-adhesive', room.id, walls, 'tiling'));
      out.push(requirement('grout', room.id, walls, 'tiling'));
    } else {
      out.push(requirement('primer', room.id, walls, 'wall-ceiling-finish'));
      out.push(requirement('paint', room.id, walls, 'wall-ceiling-finish'));
    }
  }

  if (room.works.includes('ceiling')) {
    out.push(requirement('primer', room.id, ceiling, 'wall-ceiling-finish'));
    out.push(requirement('paint', room.id, ceiling, 'wall-ceiling-finish'));
  }

  return out;
}
