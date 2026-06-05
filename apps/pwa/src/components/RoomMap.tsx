// Схема-карта комнат (D12b, обкатка v1 #2): прямоугольники по РЕАЛЬНЫМ
// габаритам комнат, но раскладка автоматическая (shelf-packing) —
// РАСПОЛОЖЕНИЕ УСЛОВНОЕ: в модели нет координат/смежностей (гл.05),
// и честная пометка обязательна по D12 (аналогия «черновой раскладки» D8).
// Тап по комнате → S3-редактор. Рендер в метрах (viewBox), как LayoutCanvas.

import { useMemo } from 'react';
import type { Project, Room } from '../types';
import { floorAreaM2 } from '../types';

interface Placed {
  room: Room;
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 0.35; // зазор между прямоугольниками схемы, м

function pack(rooms: Room[]): {
  cells: Placed[];
  width: number;
  height: number;
} {
  // Ширина полки ≈ квадрату суммарной площади — компактно без топологии.
  const total = rooms.reduce((s, r) => s + floorAreaM2(r), 0);
  const maxLen = Math.max(
    ...rooms.map((r) => Math.max(r.lengthM, r.widthM)),
    1,
  );
  const target = Math.max(Math.sqrt(total * 1.8), maxLen);
  const cells: Placed[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const room of rooms) {
    // длинной стороной по X: это схема, ориентация комнаты не утверждается
    const w = Math.max(room.lengthM, room.widthM);
    const h = Math.min(room.lengthM, room.widthM);
    if (x > 0 && x + w > target) {
      x = 0;
      y += rowH + GAP;
      rowH = 0;
    }
    cells.push({ room, x, y, w, h });
    x += w + GAP;
    rowH = Math.max(rowH, h);
  }
  return {
    cells,
    width: Math.max(...cells.map((c) => c.x + c.w)),
    height: y + rowH,
  };
}

export function RoomMap({
  project,
  onRoom,
}: {
  project: Project;
  onRoom: (roomId: string) => void;
}) {
  const layout = useMemo(() => pack(project.rooms), [project.rooms]);
  if (project.rooms.length === 0) return null;
  const PAD = 0.25;
  return (
    <div className="card roommap-card">
      <div className="plan-head">
        <span className="plan-title">Схема объекта</span>
      </div>
      {/* D12b: «честная пометка обязательна» — полноширинный баннер, не
          серая приписка (находка ревью: самый важный honesty-контрол фичи
          был самым незаметным текстом карточки) */}
      <div className="schema-warn">
        расположение комнат условное — это <b>не план квартиры</b>, только
        размеры верны
      </div>
      <svg
        className="roommap"
        viewBox={`${-PAD} ${-PAD} ${layout.width + 2 * PAD} ${layout.height + 2 * PAD}`}
        role="img"
        aria-label={`Схема комнат: ${project.title}`}
      >
        {layout.cells.map(({ room, x, y, w, h }) => {
          // имя не влезает в узкий прямоугольник — оставляем только площадь
          const showName = room.name.length * 0.19 < w && h > 0.9;
          return (
            <g
              key={room.id}
              className={room.wet ? 'rm-room wet' : 'rm-room'}
              role="button"
              tabIndex={0}
              aria-label={`${room.name}, ${floorAreaM2(room).toFixed(1)} м²`}
              onClick={() => onRoom(room.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRoom(room.id);
                }
              }}
            >
              <rect x={x} y={y} width={w} height={h} rx={0.08} />
              {showName && (
                <text x={x + w / 2} y={y + h / 2 - 0.1} className="rm-name">
                  {room.name}
                </text>
              )}
              <text
                x={x + w / 2}
                y={y + h / 2 + (showName ? 0.34 : 0.12)}
                className="rm-area"
              >
                {floorAreaM2(room).toFixed(1)} м²
              </text>
            </g>
          );
        })}
      </svg>
      <div className="plan-note center">
        тап по комнате — редактор · голубым — мокрые зоны
      </div>
    </div>
  );
}
