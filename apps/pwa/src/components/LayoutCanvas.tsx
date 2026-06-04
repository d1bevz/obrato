import { useEffect, useMemo, useState } from 'react';
import type { DrawingGeometry } from 'compute-wasm';
import { computeFloorGrid } from '../compute/client';
import type { CutOverrideDoc, LayoutDoc, ProjectDoc } from '../store/db';
import { getLayout, saveLayout } from '../store/layouts';
import type { Room } from '../types';

// S4 · LayoutCanvas (гл.08 §5, D8): наивная раскладка плитки пола.
// Источник истины — ДАННЫЕ ядра в метрах (DrawingGeometry), рендер маппит
// метры→px; правки = CutOverride поверх recomputed baseline, адресованы
// логической ячейкой (Граница C, гл.05 §6). Паттерн пилота — grid, датум —
// угол; балансировка подрезки — solver фазы 2 (это «черновая раскладка»).

type OverrideKind = CutOverrideDoc['kind'];

const CYCLE: (OverrideKind | null)[] = [null, 'mark_cut', 'suppress'];

function baselineHash(room: Room, tileWCm: number, tileHCm: number): string {
  return `${room.lengthM}|${room.widthM}|${tileWCm}|${tileHCm}`;
}

function cellKey(col: number, row: number): string {
  return `${col}:${row}`;
}

function num(s: string): number {
  const v = Number(s.replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
}

export function LayoutCanvas({
  project,
  roomId,
}: {
  project: ProjectDoc;
  roomId: string;
}) {
  const room = project.rooms.find((r) => r.id === roomId)!;
  // Deep-link guard: чертёж пола существует только у плиточного пола —
  // для остальных полов рабочий грид вводил бы в заблуждение (гл.08 §5).
  const tileFloor = room.works.floor?.finish === 'tile';
  const [tileW, setTileW] = useState('45');
  const [tileH, setTileH] = useState('45');
  const [overrides, setOverrides] = useState<Map<string, OverrideKind>>(
    new Map(),
  );
  const [staleCount, setStaleCount] = useState(0);
  const [grid, setGrid] = useState<DrawingGeometry | null | 'loading'>(
    'loading',
  );
  const [loaded, setLoaded] = useState(false);
  // Персистим только после действия пользователя: автозапись на load стёрла
  // бы stale-правки до того, как он нажал «сбросить» (баннер стал бы ложью).
  const [dirty, setDirty] = useState(false);

  // Загрузка LayoutDoc: пин плитки + правки; stale-правки (hash mismatch
  // после изменения размеров) НЕ применяются молча — баннер + сброс рукой.
  useEffect(() => {
    let gone = false;
    getLayout(project.id, roomId).then(
      (doc) => {
        if (gone) return;
        if (doc) {
          setTileW(String(doc.tileWCm));
          setTileH(String(doc.tileHCm));
          const fresh =
            doc.baselineParamsHash ===
            baselineHash(room, doc.tileWCm, doc.tileHCm);
          if (fresh) {
            setOverrides(
              new Map(doc.overrides.map((o) => [cellKey(o.col, o.row), o.kind])),
            );
          } else {
            setStaleCount(doc.overrides.length);
          }
        }
        setLoaded(true);
      },
      () => !gone && setLoaded(true),
    );
    return () => {
      gone = true;
    };
    // room намеренно вне deps: размеры комнаты меняются только через
    // RoomEditor → экран ремаунтится с новым project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, roomId]);

  const wCm = num(tileW);
  const hCm = num(tileH);
  const tilesValid = wCm >= 5 && hCm >= 5 && wCm <= 200 && hCm <= 200;

  // Пересчёт baseline-сетки ядром при смене плитки.
  useEffect(() => {
    if (!loaded || !tilesValid) {
      if (loaded) setGrid(null);
      return;
    }
    let superseded = false;
    setGrid('loading');
    computeFloorGrid({
      roomLengthM: room.lengthM,
      roomWidthM: room.widthM,
      tileWM: wCm / 100,
      tileHM: hCm / 100,
    }).then(
      (g) => !superseded && setGrid(g),
      () => !superseded && setGrid(null),
    );
    return () => {
      superseded = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, tilesValid, wCm, hCm, room.lengthM, room.widthM]);

  // Персист — эффектом по факту изменения состояния (не внутри updater'а:
  // StrictMode дважды зовёт updater; и не только из tapCell: смена размера
  // плитки тоже должна сохраняться, иначе тихо откатывается при перезаходе
  // и «сброшенные» правки воскресают — находки ревью P5).
  useEffect(() => {
    if (!loaded || !tilesValid || !dirty) return;
    const doc: LayoutDoc = {
      projectId: project.id,
      roomId,
      orgId: project.orgId,
      tileWCm: wCm,
      tileHCm: hCm,
      overrides: [...overrides.entries()].map(([k, kind]) => {
        const [col, row] = k.split(':').map(Number);
        return { col, row, kind };
      }),
      baselineParamsHash: baselineHash(room, wCm, hCm),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    };
    void saveLayout(doc).catch(() => undefined); // best-effort: чертёж recomputable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, tilesValid, dirty, wCm, hCm, overrides]);

  const tapCell = (col: number, row: number) => {
    setDirty(true);
    // функциональный апдейт: быстрый двойной тап циклит вид правки,
    // а не читает устаревшее замыкание
    setOverrides((prev) => {
      const k = cellKey(col, row);
      const cur = prev.get(k) ?? null;
      const next = new Map(prev);
      const nextKind = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      if (nextKind == null) next.delete(k);
      else next.set(k, nextKind);
      return next;
    });
    setStaleCount(0); // первая живая правка закрывает stale-вопрос
  };

  const resetStale = () => {
    setDirty(true);
    setOverrides(new Map());
    setStaleCount(0);
  };

  const counts = useMemo(() => {
    if (grid === 'loading' || grid == null) return null;
    let marked = 0;
    let suppressed = 0;
    for (const kind of overrides.values()) {
      if (kind === 'mark_cut') marked += 1;
      else suppressed += 1;
    }
    return {
      full: grid.fullCount,
      edgeCut: grid.cutCount,
      marked,
      suppressed,
    };
  }, [grid, overrides]);

  const changeTile = (setter: (v: string) => void) => (v: string) => {
    setDirty(true); // выбор плитки — тоже состояние, сохраняется (ревью P5)
    setter(v);
    // смена плитки = новый baseline: старые правки адресуют другую сетку
    if (overrides.size > 0) {
      setStaleCount(overrides.size);
      setOverrides(new Map());
    }
  };

  if (!tileFloor) {
    return (
      <main>
        <div className="card center">
          У «{room.name}» нет плиточного пола — чертёж раскладки не строится.
          Отметь «Пол: плитка» в редакторе комнаты, если планируется плитка.
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="notice">
        Черновая раскладка: датум — угол, сетка наивная. Балансировка
        подрезки по правилам тайлера — следующая фаза (D8).
      </div>

      <div className="card form-card">
        <div className="dim-row">
          <label className="dim-field">
            <span>Плитка: ширина, см</span>
            <input
              type="text"
              inputMode="decimal"
              value={tileW}
              onChange={(e) => changeTile(setTileW)(e.target.value)}
            />
          </label>
          <label className="dim-field">
            <span>высота, см</span>
            <input
              type="text"
              inputMode="decimal"
              value={tileH}
              onChange={(e) => changeTile(setTileH)(e.target.value)}
            />
          </label>
          <div className="dim-field">
            <span>комната</span>
            <div className="dim-static">
              {room.lengthM.toFixed(2)} × {room.widthM.toFixed(2)} м
            </div>
          </div>
        </div>
        {!tilesValid && (
          <div className="field-error">размер плитки — от 5 до 200 см</div>
        )}
      </div>

      {staleCount > 0 && (
        <div className="notice stale">
          {staleCount} правок устарели после изменения размеров/плитки —
          сетка пересчитана без них.{' '}
          <button type="button" className="chip" onClick={resetStale}>
            понятно, сбросить
          </button>
        </div>
      )}

      {grid === 'loading' && <div className="card center">Считаю сетку…</div>}
      {grid === null && tilesValid && (
        <div className="card error">
          {Math.ceil(room.lengthM / (wCm / 100)) *
            Math.ceil(room.widthM / (hCm / 100)) >
          20000
            ? 'Слишком мелкая плитка для этой комнаты — сетка превысила бы 20 000 ячеек. Укрупни плитку.'
            : 'Сетка не построилась — проверь размеры комнаты и плитки.'}
        </div>
      )}
      {grid !== 'loading' && grid != null && (
        <>
          <div className="card canvas-card">
            <svg
              className="layout-svg"
              viewBox={`-0.05 -0.05 ${grid.roomLengthM + 0.1} ${grid.roomWidthM + 0.1}`}
              role="img"
              aria-label={`Раскладка плитки ${room.name}`}
            >
              {grid.cells.map((c) => {
                const kind = overrides.get(cellKey(c.col, c.row)) ?? null;
                const cls =
                  kind === 'suppress'
                    ? 'cell suppress'
                    : kind === 'mark_cut'
                      ? 'cell marked'
                      : c.cut
                        ? 'cell edge-cut'
                        : 'cell';
                return (
                  <g key={cellKey(c.col, c.row)}>
                    <rect
                      className={cls}
                      x={c.xM}
                      y={c.yM}
                      width={c.wM}
                      height={c.hM}
                      onClick={() => tapCell(c.col, c.row)}
                    />
                    {kind === 'mark_cut' && (
                      <line
                        className="cut-mark"
                        x1={c.xM + 0.05}
                        y1={c.yM + 0.05}
                        x2={c.xM + c.wM - 0.05}
                        y2={c.yM + c.hM - 0.05}
                      />
                    )}
                    {kind === 'suppress' && (
                      <text
                        className="suppress-mark"
                        x={c.xM + c.wM / 2}
                        y={c.yM + c.hM / 2}
                      >
                        ✕
                      </text>
                    )}
                  </g>
                );
              })}
              <rect
                className="room-border"
                x={0}
                y={0}
                width={grid.roomLengthM}
                height={grid.roomWidthM}
              />
            </svg>
          </div>
          {counts && (
            <div className="badges legend">
              <span className="badge">целых: {counts.full}</span>
              <span className="badge q-estimated">
                подрезка края: {counts.edgeCut}
              </span>
              <span className="badge q-wide">помечено: {counts.marked}</span>
              <span className="badge muted">
                нет плитки: {counts.suppressed}
              </span>
            </div>
          )}
          <div className="roadmap">
            тап по ячейке: пометить подрез → нет плитки (трап/ниша) → сброс.
            <br />
            сетка {grid.cols} × {grid.rows} · ячейки адресуются логически —
            правки переживают zoom/рендер
          </div>
        </>
      )}
    </main>
  );
}
