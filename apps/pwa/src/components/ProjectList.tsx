import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { projectAreaM2 } from '../types';

// S1 · ProjectList (гл.08 §6): вход, список объектов, выбор за один тап.
// P0: «+ Объект» — заглушка до P2 (ввод и персист).

const STATUS_LABEL: Record<Project['status'], string> = {
  planning: 'планирование',
  active: 'в работе',
  done: 'завершён',
};

export function ProjectList({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();
  return (
    <>
      <main>
        {projects.map((p) => (
          <div
            key={p.id}
            className="card tappable"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/project/${p.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/project/${p.id}`)}
          >
            <div className="row">
              <div className="grow">
                <h2>{p.title}</h2>
                {p.address && <div className="sub">{p.address}</div>}
                <div className="badges">
                  <span className="badge status">{STATUS_LABEL[p.status]}</span>
                  <span className="badge muted">комнат: {p.rooms.length}</span>
                </div>
              </div>
              <div className="metric">
                <div className="num">{projectAreaM2(p).toFixed(1)} м²</div>
                <div className="lbl">площадь</div>
              </div>
            </div>
          </div>
        ))}
        <div className="roadmap">
          P1 · лист закупок считается ядром прямо на устройстве · дальше: свои
          замеры (P2) → упаковки «в магазин» (P3)
        </div>
      </main>
      <div className="cta">
        <button className="btn" disabled>
          + Объект
        </button>
        <div className="hint">появится в P2 — ввод замеров</div>
      </div>
    </>
  );
}
