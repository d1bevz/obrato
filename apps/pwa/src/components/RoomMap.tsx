// Схема-карта комнат (D12b + D12c, обкатка v1 #2/#2b): прямоугольники по
// РЕАЛЬНЫМ габаритам; расположение — либо автоматическое (shelf-packing,
// «условное»), либо РУЧНОЕ (D12c): режим «расставить» — drag по холсту
// (snap 0.1 м), тап = поворот 90°. Позиции — презентационный слой
// (PlacementDoc), Граница A и расчёты не тронуты. Стены/смежности/проёмы
// НЕ моделируются — баннер обязан говорить об этом (D12). Пересечения не
// запрещаются — подсвечиваются. Рендер в метрах (viewBox), как LayoutCanvas.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlacementDoc, ProjectDoc, RoomPosition } from '../store/db';
import { getPlacement, savePlacement } from '../store/placements';
import type { Room } from '../types';
import { floorAreaM2 } from '../types';

interface Cell {
  room: Room;
  x: number;
  y: number;
  w: number;
  h: number;
  manual: boolean;
}

const GAP = 0.35; // зазор авто-раскладки, м
const SNAP = 0.1; // шаг прилипания drag, м
// Порог тап/драг — в ЭКРАННЫХ px (как native touch-slop): в метрах схемы он
// плавал бы с масштабом квартиры (находка ревью итерации 3).
const TAP_SLOP_PX = 9;

function dims(room: Room, rotated: boolean): { w: number; h: number } {
  return rotated
    ? { w: room.widthM, h: room.lengthM }
    : { w: room.lengthM, h: room.widthM };
}

/** Авто-ориентация (как в D12b): длинной стороной по X. */
function autoRotated(room: Room): boolean {
  return room.widthM > room.lengthM;
}

/** Размещённые руками — по позициям; остальные — полкой ниже них. */
function layoutRooms(
  rooms: Room[],
  positions: Record<string, RoomPosition>,
): Cell[] {
  const cells: Cell[] = [];
  const rest: Room[] = [];
  for (const room of rooms) {
    const p = positions[room.id];
    if (p) {
      const { w, h } = dims(room, p.rotated);
      cells.push({ room, x: p.xM, y: p.yM, w, h, manual: true });
    } else {
      rest.push(room);
    }
  }
  if (rest.length > 0) {
    const total = rest.reduce((s, r) => s + floorAreaM2(r), 0);
    const maxLen = Math.max(
      ...rest.map((r) => Math.max(r.lengthM, r.widthM)),
      1,
    );
    const target = Math.max(Math.sqrt(total * 1.8), maxLen);
    let x = 0;
    let y = cells.length
      ? Math.max(...cells.map((c) => c.y + c.h)) + GAP
      : 0;
    let rowH = 0;
    for (const room of rest) {
      const { w, h } = dims(room, autoRotated(room));
      if (x > 0 && x + w > target) {
        x = 0;
        y += rowH + GAP;
        rowH = 0;
      }
      cells.push({ room, x, y, w, h, manual: false });
      x += w + GAP;
      rowH = Math.max(rowH, h);
    }
  }
  return cells;
}

function contentBounds(cells: Cell[]): { w: number; h: number } {
  return {
    w: Math.max(...cells.map((c) => c.x + c.w), 1),
    h: Math.max(...cells.map((c) => c.y + c.h), 1),
  };
}

export function RoomMap({
  project,
  onRoom,
}: {
  project: ProjectDoc;
  onRoom: (roomId: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [positions, setPositions] = useState<
    Record<string, RoomPosition> | 'loading'
  >('loading');
  const [editing, setEditing] = useState(false);
  // В режиме расстановки холст зафиксирован с запасом — иначе viewBox
  // «резинил» бы под пальцем на каждый move.
  const [editBox, setEditBox] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    w: number;
    h: number;
    moved: boolean;
  } | null>(null);
  // Зеркало позиций для pointer-хендлеров (события чаще рендеров).
  const posRef = useRef(positions);
  useEffect(() => {
    posRef.current = positions;
  }, [positions]);

  useEffect(() => {
    let gone = false;
    setPositions('loading');
    setEditing(false);
    setEditBox(null);
    getPlacement(project.id).then(
      (doc) => !gone && setPositions(doc?.positions ?? {}),
      () => !gone && setPositions({}),
    );
    return () => {
      gone = true;
    };
  }, [project.id]);

  const cells = useMemo(
    () =>
      positions === 'loading' ? [] : layoutRooms(project.rooms, positions),
    [project.rooms, positions],
  );

  // Пересечения не запрещаем — честно подсвечиваем (D12c).
  const overlapped = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        if (
          a.x < b.x + b.w - 0.01 &&
          b.x < a.x + a.w - 0.01 &&
          a.y < b.y + b.h - 0.01 &&
          b.y < a.y + a.h - 0.01
        ) {
          set.add(a.room.id);
          set.add(b.room.id);
        }
      }
    }
    return set;
  }, [cells]);

  if (project.rooms.length === 0 || positions === 'loading') return null;

  // Презентационные данные: локальный стейт обновляется сразу (отзывчивость
  // drag), персист best-effort следом + видимая ошибка (не общий стор —
  // инвариант «idb-сначала» тут смягчён сознательно).
  const persist = (next: Record<string, RoomPosition>) => {
    const alive = new Set(project.rooms.map((r) => r.id));
    const clean: Record<string, RoomPosition> = {};
    for (const [id, p] of Object.entries(next)) {
      if (alive.has(id)) clean[id] = p;
    }
    const doc: PlacementDoc = {
      projectId: project.id,
      orgId: project.orgId,
      positions: clean,
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    savePlacement(doc).then(
      () => setSaveError(null),
      (e) => setSaveError(e instanceof Error ? e.message : String(e)),
    );
  };

  const enterEdit = () => {
    // Фиксируем ВСЕ текущие позиции (и авто-разложенные) в ЛОКАЛЬНЫЙ драфт —
    // но НЕ персистим: запись только с первым реальным действием, иначе
    // «зашёл-вышел» сделал бы баннер «расставлено вручную» лживым
    // (honesty-инвариант D12, находка ревью итерации 3).
    const draft: Record<string, RoomPosition> = {};
    for (const c of cells) {
      draft[c.room.id] = {
        xM: c.x,
        yM: c.y,
        rotated: c.manual
          ? positions[c.room.id].rotated
          : autoRotated(c.room),
      };
    }
    const b = contentBounds(cells);
    setEditBox({
      w: b.w + Math.max(2, b.w * 0.35),
      h: b.h + Math.max(2, b.h * 0.35),
    });
    setPositions(draft);
    setEditing(true);
  };

  const exitEdit = () => {
    setEditing(false);
    setEditBox(null);
    // если ничего не персистили (не трогал) — вернуться к авто-раскладке,
    // чтобы локальный драфт не выглядел «ручным»
    getPlacement(project.id).then(
      (doc) => setPositions(doc?.positions ?? {}),
      () => undefined,
    );
  };

  /** Поворот на 90° (тап или Enter в режиме расстановки) — на том же якоре,
   * с клампом в холст: габариты после поворота другие (находка ревью). */
  const rotateRoom = (id: string) => {
    const prev = posRef.current;
    if (prev === 'loading') return;
    const cur = prev[id];
    const room = project.rooms.find((r) => r.id === id);
    if (!cur || !room) return;
    const { w, h } = dims(room, !cur.rotated);
    const next = {
      ...prev,
      [id]: {
        rotated: !cur.rotated,
        xM: editBox ? Math.max(0, Math.min(cur.xM, editBox.w - w)) : cur.xM,
        yM: editBox ? Math.max(0, Math.min(cur.yM, editBox.h - h)) : cur.yM,
      },
    };
    setPositions(next);
    persist(next);
  };

  const toSvg = (e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      ctm.inverse(),
    );
    return { x: pt.x, y: pt.y };
  };

  const onDown = (e: React.PointerEvent, cell: Cell) => {
    if (!editing) return;
    const p = toSvg(e);
    if (!p) return;
    try {
      // capture держит drag при выходе пальца за прямоугольник; без него
      // drag деградирует, но работает — не роняем onDown (NotFoundError
      // на нестандартных pointerId)
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* без capture */
    }
    dragRef.current = {
      id: cell.room.id,
      startX: p.x,
      startY: p.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: cell.x,
      origY: cell.y,
      w: cell.w,
      h: cell.h,
      moved: false,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !editing || !editBox) return;
    const p = toSvg(e);
    if (!p) return;
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    if (
      !d.moved &&
      Math.hypot(e.clientX - d.startClientX, e.clientY - d.startClientY) <
        TAP_SLOP_PX
    ) {
      return;
    }
    d.moved = true;
    // округление до сантиметров поверх снапа — без float-хвостов в сторе
    const clampSnap = (v: number, max: number) =>
      Math.round(
        Math.min(Math.max(0, Math.round(v / SNAP) * SNAP), Math.max(0, max)) *
          100,
      ) / 100;
    setPositions((prev) => {
      if (prev === 'loading') return prev;
      const cur = prev[d.id];
      return {
        ...prev,
        [d.id]: {
          ...cur,
          xM: clampSnap(d.origX + dx, editBox.w - d.w),
          yM: clampSnap(d.origY + dy, editBox.h - d.h),
        },
      };
    });
  };

  const onUp = (e: React.PointerEvent, cell: Cell) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.id !== cell.room.id) return; // только структурный гард
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* capture не было */
    }
    const prev = posRef.current;
    if (prev === 'loading') return;
    if (d.moved) {
      // персист НЕЗАВИСИМО от editing: «✓ готово» второй рукой между
      // down и up не должно терять подвинутое (находка ревью)
      persist(prev);
      return;
    }
    if (!editing) return;
    rotateRoom(d.id);
  };

  const onCancel = (e: React.PointerEvent) => {
    // системный жест/скролл оборвал drag: подвинутое сохраняем, не теряем
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* capture не было */
    }
    const prev = posRef.current;
    if (d?.moved && prev !== 'loading') persist(prev);
  };

  const manualAny = cells.some((c) => c.manual);
  const view = editing && editBox ? editBox : contentBounds(cells);
  const PAD = 0.25;

  return (
    <div className="card roommap-card">
      <div className="plan-head">
        <span className="plan-title">Схема объекта</span>
        <button
          type="button"
          className="chip"
          aria-pressed={editing}
          onClick={editing ? exitEdit : enterEdit}
        >
          {editing ? '✓ готово' : '✋ расставить'}
        </button>
      </div>
      {/* D12: honesty-пометка обязательна — баннером, не припиской */}
      <div className="schema-warn">
        {editing ? (
          <>
            тащи комнату на её место в квартире · тап — повернуть ·
            сохраняется само
          </>
        ) : manualAny ? (
          <>
            расставлено вручную: размеры — из замеров; стены и проёмы{' '}
            <b>не моделируются</b>
          </>
        ) : (
          <>
            расположение комнат условное — это <b>не план квартиры</b>,
            только размеры верны
          </>
        )}
      </div>
      {saveError && (
        <div className="field-error">расстановка не сохранилась: {saveError}</div>
      )}
      <svg
        ref={svgRef}
        className={editing ? 'roommap editing' : 'roommap'}
        viewBox={`${-PAD} ${-PAD} ${view.w + 2 * PAD} ${view.h + 2 * PAD}`}
        role="img"
        aria-label={`Схема комнат: ${project.title}`}
      >
        {editing && editBox && (
          <rect
            className="rm-canvas"
            x={0}
            y={0}
            width={editBox.w}
            height={editBox.h}
          />
        )}
        {cells.map((cell) => {
          const { room, x, y, w, h } = cell;
          const showName = room.name.length * 0.19 < w && h > 0.9;
          const cls = [
            'rm-room',
            room.wet ? 'wet' : '',
            overlapped.has(room.id) ? 'overlap' : '',
            editing ? 'editing' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <g
              key={room.id}
              className={cls}
              role="button"
              tabIndex={0}
              aria-label={
                editing
                  ? `${room.name}, ${floorAreaM2(room).toFixed(1)} м² — Enter повернёт на 90°`
                  : `${room.name}, ${floorAreaM2(room).toFixed(1)} м²`
              }
              onClick={() => !editing && onRoom(room.id)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                // в режиме расстановки Enter/Space зеркалит тап-поворот —
                // role=button не глотает клавиши молча (находка ревью)
                if (editing) rotateRoom(room.id);
                else onRoom(room.id);
              }}
              onPointerDown={(e) => onDown(e, cell)}
              onPointerMove={onMove}
              onPointerUp={(e) => onUp(e, cell)}
              onPointerCancel={onCancel}
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
        {editing
          ? 'красный пунктир — комнаты пересекаются'
          : `тап по комнате — редактор · голубым — мокрые зоны${
              overlapped.size > 0 ? ' · красный пунктир — пересечение' : ''
            }`}
      </div>
    </div>
  );
}
