import { useResource } from "../../../shared/hooks/operationsData";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { getSharedSimulation } from "../../simulation/api/simulationApi";
import type { StudentClassSummary } from "../../school/api/schoolApi";
import { indexAtTime } from "../../simulation/model/learningModel";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import type { Curriculum, LibraryItem, Simulation } from "../../../shared/types/physlive";
import type { ResourceDiscovery } from "../../library/components/ResourceDiscovery";

export function useStudentResources(userId: number | undefined, loadLibrary = true) {
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [simulationError, setSimulationError] = useState("");
  const [frame, setFrame] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const mountedRef = useRef(true);
  const simulationRequestRef = useRef(0);
  const isCurrentSession = useCallback(() => mountedRef.current && userId !== undefined && useSessionStore.getState().user?.id === userId, [userId]);

  const libraryResource = useResource<LibraryItem[]>("/library/community", Boolean(userId && loadLibrary));
  const curriculumResource = useResource<Curriculum>("/curriculum", Boolean(userId && loadLibrary));
  const classesResource = useResource<StudentClassSummary[]>("/student/classes", Boolean(userId));
  const items = useMemo(() => (libraryResource.data ?? []).filter(item => item.visibility === "SHARED" || item.visibility === "PUBLIC"), [libraryResource.data]);
  const catalog = curriculumResource.data ?? null;
  const classes = classesResource.data ?? [];
  const loading = loadLibrary && (libraryResource.loading || curriculumResource.loading);
  const classesLoading = classesResource.loading;
  const error = libraryResource.error || curriculumResource.error || "";
  const classesError = classesResource.error || "";
  const load = () => Promise.all([libraryResource.refresh(), curriculumResource.refresh()]);
  const loadClasses = classesResource.refresh;
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; simulationRequestRef.current += 1; };
  }, []);

  const close = () => {
    simulationRequestRef.current += 1;
    setSelectedItem(null);
    setSimulation(null);
    setFrame(0);
    setTime(0);
    setSimulationLoading(false);
    setSimulationError("");
    setPlaying(false);
  };
  const open = async (item: LibraryItem) => {
    if (!isCurrentSession()) return;
    const requestId = ++simulationRequestRef.current;
    setSelectedItem(item);
    setSimulation(null);
    setFrame(0);
    setTime(0);
    setPlaying(false);
    setSimulationLoading(true);
    setSimulationError("");
    try {
      const loaded = await getSharedSimulation(item.simulationId);
      if (!isCurrentSession() || requestId !== simulationRequestRef.current) return;
      setSimulation(loaded);
      setTime(loaded.time[0] ?? 0);
    } catch {
      if (isCurrentSession() && requestId === simulationRequestRef.current) setSimulationError("Chưa tải được mô phỏng trong tài nguyên này.");
    } finally {
      if (isCurrentSession() && requestId === simulationRequestRef.current) setSimulationLoading(false);
    }
  };
  const discovery: Omit<ComponentProps<typeof ResourceDiscovery>, "vectors"> = {
    items, curriculum: catalog, loading, error,
    onRetry: () => { void load(); },
    selectedItem, simulation, time, simulationLoading, simulationError, frame, playing,
    onOpen: item => { void open(item); },
    onClose: close,
    onTogglePlaying: () => setPlaying(value => !value),
    onReset: () => {
      setPlaying(false);
      setFrame(0);
      setTime(simulation?.time[0] ?? 0);
    },
    onFrameChange: frameValue => {
      setPlaying(false);
      const nextFrame = Math.min(Math.max(0, frameValue), Math.max(0, (simulation?.time.length ?? 1) - 1));
      setFrame(nextFrame);
      setTime(simulation?.time[nextFrame] ?? 0);
    },
    onTimeChange: nextTime => {
      if (!simulation) return;
      setFrame(indexAtTime(simulation.time, nextTime));
      setTime(nextTime);
    },
    onPlaybackEnd: () => setPlaying(false),
  };
  return { classes, classesLoading, classesError, loadClasses, discovery, close };
}
