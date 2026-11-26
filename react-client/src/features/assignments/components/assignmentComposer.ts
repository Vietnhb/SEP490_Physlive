import type { FormEvent } from "react";
import type { AssignmentActivityType, LibraryItem, Simulation, StudentOption, TeacherClassOption } from "../../../shared/types/physlive";
import { prettyUnit, type SceneDescriptor } from "../../simulation/model/sceneModel";
import type { SolverTimeline } from "../../simulation/model/svgScene";

export type TeacherAssignmentFormProps = {
  workspaceLayout: boolean;
  saved: LibraryItem[];
  selectedLibrary: LibraryItem | undefined;
  libraryItemId: string;
  title: string;
  description: string;
  prompt: string;
  activityType: AssignmentActivityType;
  simulation: Simulation | null;
  simulationOptionsLoading: boolean;
  simulationOptionsError: boolean;
  targetSeriesSource: string;
  sampleTime: string;
  measurementTolerance: string;
  investigationParameter: string;
  investigationOutcome: string;
  maxScore: string;
  dueAt: string;
  allowLateSubmission: boolean;
  onAllowLateSubmissionChange: (value: boolean) => void;
  students: StudentOption[];
  classes: TeacherClassOption[];
  selectedClassId: string;
  selectedStudents: number[];
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLibraryChange: (id: string) => void;
  onTitleChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onActivityTypeChange: (value: AssignmentActivityType) => void;
  onTargetSeriesSourceChange: (value: string) => void;
  onSampleTimeChange: (value: string) => void;
  onMeasurementToleranceChange: (value: string) => void;
  onInvestigationParameterChange: (value: string) => void;
  onInvestigationOutcomeChange: (value: string) => void;
  onMaxScoreChange: (value: string) => void;
  onDueAtChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onToggleStudent: (id: number) => void;
  onSelectAll: () => void;
  onClassChange: (id: string) => void;
};

export const ACTIVITIES: { value: AssignmentActivityType; label: string; help: string; icon: "bulb" | "chart" | "sliders" | "play"; prompt: string }[] = [
  { value: "PREDICT_OBSERVE_EXPLAIN", label: "Dự đoán – giải thích", help: "Học sinh dự đoán trước, rồi mở mô phỏng để đối chiếu.", icon: "bulb", prompt: "Câu hỏi dự đoán" },
  { value: "MEASUREMENT", label: "Đo đại lượng", help: "Học sinh đọc một đại lượng tại thời điểm thầy cô chọn.", icon: "chart", prompt: "Yêu cầu đo và giải thích" },
  { value: "PARAMETER_INVESTIGATION", label: "Khảo sát tham số", help: "Học sinh thay đổi một tham số và tìm quy luật.", icon: "sliders", prompt: "Câu hỏi khảo sát" },
  { value: "FREE_EXPLORATION", label: "Khám phá tự do", help: "Mô phỏng mở ngay, học sinh tự quan sát và kết luận.", icon: "play", prompt: "Nhiệm vụ khám phá" },
];
export const STEPS = ["Nội dung bài", "Lớp & hạn nộp", "Xem lại & giao"];

/** Value for a datetime-local `min`, in the viewer's own time zone. */
export function localDateTime(time: number) {
  const date = new Date(time - new Date(time).getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

/** What each step still needs; shared by the Radix form and the canvas composer so both block on the same rules. */
export function assignmentChecks(p: Pick<TeacherAssignmentFormProps, "selectedLibrary" | "simulation" | "title" | "prompt" | "maxScore" | "activityType" | "targetSeriesSource" | "sampleTime" | "measurementTolerance" | "investigationParameter" | "dueAt" | "selectedClassId" | "selectedStudents">, now: number) {
  const typeConfigValid = p.activityType === "MEASUREMENT"
    ? Boolean(p.targetSeriesSource && p.sampleTime.trim() && Number.isFinite(Number(p.sampleTime)) && p.measurementTolerance.trim() && Number.isFinite(Number(p.measurementTolerance)) && Number(p.measurementTolerance) >= 0)
    : p.activityType === "PARAMETER_INVESTIGATION" ? Boolean(p.investigationParameter) : true;
  const contentValid = Boolean(p.selectedLibrary && p.simulation && p.title.trim() && p.title.trim().length <= 160 && p.prompt.trim()) && Number(p.maxScore) >= 0.001 && Number(p.maxScore) <= 99999.999 && Number.isFinite(Number(p.maxScore)) && typeConfigValid;
  const dueInPast = Boolean(p.dueAt) && new Date(p.dueAt).getTime() <= now;
  const recipientsValid = Boolean(p.selectedClassId) && p.selectedStudents.length > 0 && !dueInPast;
  return { typeConfigValid, contentValid, dueInPast, recipientsValid };
}

export type MeasurableSeries = { source: string; label: string; unit: string };
type StoredScene = { presentation?: { scene?: SceneDescriptor }; simulationSpec?: { solverTimeline?: SolverTimeline } };

/** The stored solver timeline of a scene built by the new pipeline (its run carries no `time` series of its own). */
const storedTimeline = (simulation: Simulation | null) => (simulation?.result as StoredScene | undefined)?.simulationSpec?.solverTimeline;

/**
 * What a measurement can sample. Older runs list their series in `visualization`; scenes built by the new pipeline keep
 * theirs in the stored solver timeline, named by the scene's fields (the backend samples them as `timeline.<field>`).
 */
export function measurableSeries(simulation: Simulation | null): MeasurableSeries[] {
  const listed = simulation?.visualization?.series ?? [];
  if (listed.length) return listed.map(item => ({ source: item.source, label: item.label, unit: item.unit ?? "" }));
  const scene = (simulation?.result as StoredScene | undefined)?.presentation?.scene;
  const frame = storedTimeline(simulation)?.frames?.[0]?.values;
  if (!scene?.fields || !frame) return [];
  const frames = storedTimeline(simulation)?.frames ?? [];
  const varies = (key: string) => frames.some(item => item.values[key] !== frame[key]);
  // values that change over time come first: a constant (a stopping time, say) reads the same at every instant
  const keys = [...new Set([...(scene.observables ?? []), ...Object.keys(scene.fields)])]
    .filter(key => scene.fields[key] && typeof frame[key] === "number")
    .sort((a, b) => Number(varies(b)) - Number(varies(a)));
  return keys.map(key => {
    const field = scene.fields[key];
    const unit = prettyUnit(field.unit ?? "");
    // labels often end with their unit already ("Vận tốc (m/s)"); the form adds it back once
    const name = (field.caption || field.label || key).replace(/\s*\([^()]*\)\s*$/, "").trim() || key;
    return { source: `timeline.${key}`, label: field.object ? `${name} · ${field.object}` : name, unit };
  });
}

/** The last time a measurement can be taken at, in seconds, rounded to the millisecond (solver ends land on 7.4999…). */
export function simulationEnd(simulation: Simulation | null) {
  const end = simulation?.time?.at(-1) ?? storedTimeline(simulation)?.frames?.at(-1)?.t ?? 0;
  return Math.round(end * 1000) / 1000;
}
