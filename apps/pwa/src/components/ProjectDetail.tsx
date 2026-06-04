import { useNavigate } from 'react-router-dom';
import type { Project, Room } from '../types';
import {
  FLOOR_FINISH_LABEL,
  ROOM_TYPE_ICON,
  ROOM_TYPE_LABEL,
  floorAreaM2,
  projectAreaM2,
} from '../types';

// S2 · ProjectDetail (гл.08 §6): хаб объекта — комнаты, статус, итог.
// P1: CTA «Список закупок» ведёт на S5 (расчёт ядром на устройстве).

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

function RoomCard({ room }: { room: Room }) {
  return (
    <div className="card">
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
      </div>
    </div>
  );
}

export function ProjectDetail({ project }: { project: Project }) {
  const navigate = useNavigate();
  return (
    <>
      <main>
        <div className="summary">
          <span>
            {project.rooms.length} комнат ·{' '}
            {project.rooms.filter((r) => r.wet).length} мокрая зона
          </span>
          <span>
            итого <b>{projectAreaM2(project).toFixed(1)} м²</b>
          </span>
        </div>
        {project.rooms.map((r) => (
          <RoomCard key={r.id} room={r} />
        ))}
      </main>
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
    </>
  );
}
