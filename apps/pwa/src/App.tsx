import { Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { FLATPLAN_DEMO } from './demo/flatplan';
import { OfflineBadge } from './components/OfflineBadge';
import { ProjectList } from './components/ProjectList';
import { ProjectDetail } from './components/ProjectDetail';
import { PurchaseList } from './components/PurchaseList';

// P1: демо-проект + лист закупок (расчёт ядром на устройстве).
// P2 добавит создание/редактирование и персист в IndexedDB.
const PROJECTS = [FLATPLAN_DEMO];

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

function ListScreen() {
  return (
    <>
      <Topbar title="Obrato" />
      <ProjectList projects={PROJECTS} />
    </>
  );
}

function DetailScreen() {
  const { projectId } = useParams();
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    return (
      <>
        <Topbar title="Obrato" back />
        <main>
          <div className="card">Объект не найден.</div>
        </main>
      </>
    );
  }
  return (
    <>
      <Topbar title={project.title} back />
      <ProjectDetail project={project} />
    </>
  );
}

function PurchaseScreen() {
  const { projectId } = useParams();
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) {
    return (
      <>
        <Topbar title="Obrato" back />
        <main>
          <div className="card">Объект не найден.</div>
        </main>
      </>
    );
  }
  return (
    <>
      <Topbar title="Лист закупок" back />
      <PurchaseList project={project} />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ListScreen />} />
      <Route path="/project/:projectId" element={<DetailScreen />} />
      <Route path="/project/:projectId/purchase" element={<PurchaseScreen />} />
    </Routes>
  );
}
