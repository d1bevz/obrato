import type { ReactElement } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { OfflineBadge } from './components/OfflineBadge';
import { ProjectList } from './components/ProjectList';
import { ProjectDetail } from './components/ProjectDetail';
import { PurchaseList } from './components/PurchaseList';
import { RoomEditor } from './components/RoomEditor';
import { SnapshotView } from './components/SnapshotView';
import { ProcurementEntry } from './components/ProcurementEntry';
import { LayoutCanvas } from './components/LayoutCanvas';
import { useProject, useProjects } from './store/hooks';
import type { ProjectDoc } from './store/db';

// P2: проекты живут в IndexedDB (стор), полный CRUD комнат через S3.
// Маршруты гл.09 §1: S1 список → S2 объект → S3 комната → S5 лист.

function Topbar({ title, back }: { title: string; back?: boolean }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button className="back" aria-label="Назад" onClick={() => navigate(-1)}>
          ‹
        </button>
      )}
      <span className="brand">{title}</span>
      <span className="spacer" />
      <OfflineBadge />
    </header>
  );
}

function NotFound({
  ready,
  error,
  what = 'Объект',
}: {
  ready: boolean;
  error?: string | null;
  what?: string;
}) {
  return (
    <>
      <Topbar title="Obrato" back />
      <main>
        {error ? (
          <div className="card error">Хранилище недоступно: {error}</div>
        ) : (
          <div className="card center">
            {ready ? `${what} не найден.` : 'Загружаю…'}
          </div>
        )}
      </main>
    </>
  );
}

/** Хелпер экранов S2/S3/S5: грузит проект по :projectId из стора. */
function withProject(
  render: (project: ProjectDoc, roomId?: string) => ReactElement,
) {
  return function ProjectScreen() {
    const { projectId, roomId } = useParams();
    const { project, ready, storeError } = useProject(projectId);
    if (!project) return <NotFound ready={ready} error={storeError} />;
    // Deep-link на удалённую/несуществующую комнату — честный 404,
    // а не молчаливый режим создания (находка ревью P2).
    if (roomId && !project.rooms.some((r) => r.id === roomId)) {
      return <NotFound ready={ready} what="Комната" />;
    }
    return render(project, roomId);
  };
}

const ListScreen = () => {
  const { projects, ready, storeError } = useProjects();
  return (
    <>
      <Topbar title="Obrato" />
      <ProjectList projects={projects} ready={ready} storeError={storeError} />
    </>
  );
};

const DetailScreen = withProject((project) => (
  <>
    <Topbar title={project.title} back />
    <ProjectDetail project={project} />
  </>
));

const PurchaseScreen = withProject((project) => (
  <>
    <Topbar title="Лист закупок" back />
    <PurchaseList project={project} />
  </>
));

const RoomNewScreen = withProject((project) => (
  <>
    <Topbar title="Новая комната" back />
    <RoomEditor project={project} />
  </>
));

function SnapshotScreen() {
  const { snapshotId } = useParams();
  return (
    <>
      <Topbar title="Снапшот листа" back />
      {snapshotId && <SnapshotView snapshotId={snapshotId} />}
    </>
  );
}

function ActualsScreen() {
  const { snapshotId } = useParams();
  return (
    <>
      <Topbar title="Факт закупки" back />
      {snapshotId && <ProcurementEntry snapshotId={snapshotId} />}
    </>
  );
}

const LayoutScreen = withProject((project, roomId) => (
  <>
    <Topbar
      title={`Чертёж · ${project.rooms.find((r) => r.id === roomId)?.name ?? ''}`}
      back
    />
    <LayoutCanvas project={project} roomId={roomId!} />
  </>
));

const RoomEditScreen = withProject((project, roomId) => (
  <>
    <Topbar
      title={
        project.rooms.find((r) => r.id === roomId)?.name ?? 'Комната'
      }
      back
    />
    <RoomEditor project={project} roomId={roomId} />
  </>
));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ListScreen />} />
      <Route path="/project/:projectId" element={<DetailScreen />} />
      <Route path="/project/:projectId/purchase" element={<PurchaseScreen />} />
      <Route path="/project/:projectId/room/new" element={<RoomNewScreen />} />
      <Route
        path="/project/:projectId/room/:roomId"
        element={<RoomEditScreen />}
      />
      <Route
        path="/project/:projectId/room/:roomId/layout"
        element={<LayoutScreen />}
      />
      <Route
        path="/project/:projectId/snapshot/:snapshotId"
        element={<SnapshotScreen />}
      />
      <Route
        path="/project/:projectId/snapshot/:snapshotId/actuals"
        element={<ActualsScreen />}
      />
    </Routes>
  );
}
