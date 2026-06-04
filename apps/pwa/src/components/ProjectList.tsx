import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectDoc } from '../store/db';
import { createProject } from '../store/projectStore';
import type { Project } from '../types';
import { projectAreaM2 } from '../types';

// S1 · ProjectList (гл.08 §6): вход, список объектов, выбор за один тап.
// P2: «+ Объект» создаёт проект в IndexedDB и ведёт в S2.

const STATUS_LABEL: Record<Project['status'], string> = {
  planning: 'планирование',
  active: 'в работе',
  done: 'завершён',
};

export function ProjectList({
  projects,
  ready,
  storeError,
}: {
  projects: ProjectDoc[];
  ready: boolean;
  storeError: string | null;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addProject = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const n = projects.length + 1;
      const doc = await createProject(`Объект ${n}`);
      navigate(`/project/${doc.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <>
      <main>
        {storeError && (
          <div className="card error">
            Хранилище недоступно: {storeError}. Данные не сохранятся —
            проверь режим браузера (private mode?) и свободное место.
          </div>
        )}
        {error && <div className="card error">Не сохранилось: {error}</div>}
        {!ready && !storeError && <div className="card center">Загружаю…</div>}
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
          P2 · свои замеры: комнаты с шаблонами, всё хранится на устройстве ·
          дальше: упаковки «в магазин» (P3)
        </div>
      </main>
      <div className="cta">
        <button
          className="btn primary"
          onClick={addProject}
          disabled={!ready || busy || storeError != null}
        >
          {busy ? 'Создаю…' : '+ Объект'}
        </button>
        <div className="hint">тип → размеры → состав работ → лист закупок</div>
      </div>
    </>
  );
}
