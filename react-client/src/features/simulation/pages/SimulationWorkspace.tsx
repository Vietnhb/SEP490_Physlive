import FallbackHeading from "../../../shared/layout/FallbackHeading";
import { useEffect, useEffectEvent, useState } from "react";
import { useLocation } from "react-router-dom";
import LearningHeader from "../../../shared/layout/LearningHeader";
import PageActions from "../../../shared/layout/PageActions";
import Icon from "../../../shared/ui/LearningIcon";
import TeacherLibraryPane from "../../library/components/TeacherLibraryPane";
import { useTeacherLibrary } from "../../library/hooks/useTeacherLibrary";
import SimulationStage from "../components/SimulationStage";
import SimulationInspector from "../components/SimulationInspector";
import { useSimulationWorkspace } from "../hooks/useSimulationWorkspace";
import "../styles/learning.css";
import "../styles/simulation.css";
import "../styles/teacher-workspace.css";

export default function SimulationWorkspace({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"observe" | "inspect">("observe");
  const [readoutsTarget, setReadoutsTarget] = useState<HTMLDivElement | null>(null);
  const libraryState = useTeacherLibrary();
  const { canManageLearningContent, events, library, input, preview, experiment, explanation, save } = useSimulationWorkspace(libraryState);
  // "Mô phỏng mới" in the teacher side bar arrives with a fresh state: start over even when the workspace is already open
  const fresh = (useLocation().state as { fresh?: number } | null)?.fresh;
  const startFresh = useEffectEvent(() => {
    // a description is still being turned into a simulation: leave it alone rather than wipe what the teacher typed
    if (input.busy) return;
    input.reset();
    input.setText("");
    setMobilePanel("observe");
    requestAnimationFrame(() => document.getElementById("simulation-input")?.focus());
  });
  useEffect(() => { if (fresh) startFresh(); }, [fresh]);
  return (
    <div className="learning-app simulation-workspace-app teacher-workspace-m3" onPaste={events.onPaste} onDrop={events.onDrop}
      onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}>
      {/* "Mô phỏng mới" lives in the library pane; the header offers it only when that pane is not on screen */}
      {/* in the teacher shell the library pane folds itself (its own buttons); the top bar keeps only "Mô phỏng mới" for readers without a library */}
      {embedded ? !canManageLearningContent && <PageActions><button type="button" className="btn btn-sm" onClick={input.reset}><svg className="icon" aria-hidden="true"><use href="#i-plus" /></svg>Mô phỏng mới</button></PageActions> : <LearningHeader onNewSimulation={!canManageLearningContent || libraryCollapsed ? input.reset : undefined} libraryCollapsed={libraryCollapsed}
        onToggleLibrary={canManageLearningContent ? () => setLibraryCollapsed(value => !value) : undefined} />}
      <main className="learn-workspace" id="learning-workspace">
        <FallbackHeading title="Mô phỏng" />
        <div className="learn-top-area" aria-hidden="true" />
        <nav className="learn-mobile-nav" aria-label="Chuyển vùng học tập">
          <button type="button" aria-pressed={mobilePanel === "observe"} onClick={() => setMobilePanel("observe")}>
            <Icon name="play" /> Quan sát
          </button>
          <button type="button" aria-pressed={mobilePanel === "inspect"} onClick={() => setMobilePanel("inspect")}>
            <Icon name="sliders" /> Thông số & Chi tiết
          </button>
        </nav>
        <div className="learn-layout" data-mobile-panel={mobilePanel} data-library-pane={canManageLearningContent}
          data-library-collapsed={libraryCollapsed}>
          {canManageLearningContent && <TeacherLibraryPane {...library} {...(embedded ? { collapsed: libraryCollapsed, onToggleCollapsed: () => setLibraryCollapsed(value => !value), onNewSimulation: input.reset } : {})} />}
          <SimulationStage input={input} preview={preview} readoutsTarget={readoutsTarget}
            complaint={canManageLearningContent ? { simulationId: save.currentSimulationId || undefined, description: experiment.simulation?.description, parameters: experiment.values } : undefined} />
          <SimulationInspector experiment={experiment} explanation={explanation} save={save} library={library}
            readoutsRef={setReadoutsTarget} onSelectExample={description => {
              input.reset(); input.setSourceMode("TEXT"); input.setText(description);
              setMobilePanel("observe");
              requestAnimationFrame(() => document.getElementById("simulation-input")?.focus());
            }} />
        </div>
      </main>
    </div>
  );
}
