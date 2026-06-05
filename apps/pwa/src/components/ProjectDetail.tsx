import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ObjectPlan } from './ObjectPlan';
import { RoomMap } from './RoomMap';
import type { ProjectDoc, SnapshotDoc } from '../store/db';
import { deleteProject, updateProject } from '../store/projectStore';
import { listSnapshots } from '../store/snapshots';
import type { Room } from '../types';
import {
  FLOOR_FINISH_LABEL,
  ROOM_TYPE_ICON,
  ROOM_TYPE_LABEL,
  floorAreaM2,
  projectAreaM2,
} from '../types';

// S2 · ProjectDetail (гл.08 §6): хаб объекта — комнаты, статус, итог.
// P2: тап по комнате → S3-редактор; «+ Комната»; название/адрес правятся
// инлайн; CTA «Список закупок» → S5.

function workBadges(r: Room): string[] {
  const out: string[] = [];
  if (r.works.floor && r.works.floor.finish !== 'none') {
    out.push(`пол: ${FLOOR_FINISH_LABEL[r.works.floor.finish]}`);
  }
  if (r.works.walls) {
    out.push(r.wet ? 'стены: плитка' : 'стены: краска');
  }
  if (r.works.ceiling) {
    out.push('потолок');
  }
  if (r.works.electricPoints) {
    const e = r.works.electricPoints;
    out.push(`электрика: ${e.sockets + e.switches + e.lights} точек`);
  }
  return out;
}

function RoomCard({
  room,
  onOpen,
  onLayout,
}: {
  room: Room;
  onOpen: () => void;
  /** S4: чертёж пола — есть только у плиточных полов (naive grid, P5). */
  onLayout?: () => void;
}) {
  return (
    <div
      className="card tappable"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        // нативная кнопка активируется и Enter, и Space (a11y)
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="row">
        <div className="type-icon" aria-hidden>
          {ROOM_TYPE_ICON[room.type]}
        </div>
        <div className="grow">
          <h2>{room.name}</h2>
          <div className="dims">
            {room.lengthM.toFixed(2)} × {room.widthM.toFixed(2)} × h{' '}
            {room.heightM.toFixed(2)} м · {ROOM_TYPE_LABEL[room.type]}
          </div>
        </div>
        <div className="metric">
          <div className="num">{floorAreaM2(room).toFixed(1)} м²</div>
          <div className="lbl">пол</div>
        </div>
      </div>
      <div className="badges">
        {room.wet && (
          <span className="badge wet">
            💧 мокрая зона · заход {room.wetZoneHeightM?.toFixed(1) ?? '2.0'} м
          </span>
        )}
        {workBadges(room).map((b) => (
          <span key={b} className="badge">
            {b}
          </span>
        ))}
        {room.openings.length > 0 && (
          <span className="badge muted">проёмов: {room.openings.length}</span>
        )}
        {onLayout && (
          <button
            type="button"
            className="chip"
            onClick={(e) => {
              e.stopPropagation();
              onLayout();
            }}
          >
            📐 чертёж пола
          </button>
        )}
      </div>
    </div>
  );
}

export function ProjectDetail({ project }: { project: ProjectDoc }) {
  const navigate = useNavigate();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [snapshots, setSnapshots] = useState<SnapshotDoc[]>([]);

  useEffect(() => {
    let gone = false;
    listSnapshots(project.id).then(
      (s) => !gone && setSnapshots(s),
      () => undefined, // нет снапшотов — не повод ронять экран
    );
    return () => {
      gone = true;
    };
  }, [project.id]);

  const [opError, setOpError] = useState<string | null>(null);

  const commitTitle = async () => {
    setEditingTitle(false);
    const t = title.trim();
    try {
      if (t && t !== project.title) {
        await updateProject(project.id, { title: t });
      } else {
        setTitle(project.title);
      }
    } catch (e) {
      setTitle(project.title);
      setOpError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeProject = async () => {
    if (!window.confirm(`Удалить объект «${project.title}» целиком?`)) return;
    try {
      await deleteProject(project.id);
      navigate('/');
    } catch (e) {
      setOpError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <main>
        {opError && <div className="card error">Не сохранилось: {opError}</div>}
        <div className="summary">
          {editingTitle ? (
            <input
              className="title-input"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === 'Enter' && commitTitle()}
            />
          ) : (
            <button
              type="button"
              className="title-edit"
              onClick={() => setEditingTitle(true)}
              title="Переименовать"
            >
              {project.title} ✎
            </button>
          )}
          <span>
            итого <b>{projectAreaM2(project).toFixed(1)} м²</b>
          </span>
        </div>
        <div className="summary">
          <span>
            {project.rooms.length} комнат ·{' '}
            {project.rooms.filter((r) => r.wet).length} мокрых
          </span>
        </div>
        {project.rooms.map((r) => (
          <RoomCard
            key={r.id}
            room={r}
            onOpen={() => navigate(`/project/${project.id}/room/${r.id}`)}
            onLayout={
              r.works.floor?.finish === 'tile'
                ? () => navigate(`/project/${project.id}/room/${r.id}/layout`)
                : undefined
            }
          />
        ))}
        <button
          type="button"
          className="btn outline"
          onClick={() => navigate(`/project/${project.id}/room/new`)}
        >
          + Комната
        </button>
        {/* D12 (обкатка v1 #2): план-картинка + условная схема-карта.
            ПОСЛЕ комнат: рабочий объект S2 — комнаты и CTA листа, план —
            референс для глаза (находка ревью: не топить основной флоу). */}
        <ObjectPlan project={project} />
        <RoomMap
          project={project}
          onRoom={(roomId) => navigate(`/project/${project.id}/room/${roomId}`)}
        />
        {snapshots.length > 0 && (
          <>
            <div className="summary">
              <span>взято в магазин (снапшоты)</span>
            </div>
            {snapshots.map((s) => (
              <div
                key={s.id}
                className="card tappable"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/project/${project.id}/snapshot/${s.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/project/${project.id}/snapshot/${s.id}`);
                  }
                }}
              >
                <div className="row">
                  <div className="grow">
                    ❄{' '}
                    {new Date(s.createdAt).toLocaleString('ru', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </div>
                  <div className="metric">
                    <div className="num">
                      ≈ {Math.round(s.frozenList.total.expectedMinorUnits / 100)} €
                    </div>
                    <div className="lbl">ориентир</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {project.rooms.length === 0 && (
          <div className="roadmap">
            добавь первую комнату: тип → размеры → состав работ
          </div>
        )}
        <button type="button" className="btn danger-link" onClick={removeProject}>
          Удалить объект
        </button>
      </main>
      {project.rooms.length > 0 && (
        <div className="cta">
          <button
            className="btn primary"
            onClick={() => navigate(`/project/${project.id}/purchase`)}
          >
            Список закупок
          </button>
          <div className="hint">
            расчёт на устройстве — нормы гл.07, диапазоны + цены-«ориентир»
          </div>
        </div>
      )}
    </>
  );
}
