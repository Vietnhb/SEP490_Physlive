import { useEffect, useState, type FormEvent } from "react";
import { simulationCurriculum } from "../../curriculum/api/curriculumApi";
import { createLibraryFolder } from "../api/libraryApi";
import { saveGeneratedSimulation, type GeneratedSimulationResult } from "../../simulation/api/simulationUnderstandingApi";
import type { Curriculum, LibraryFolder, LibraryItem } from "../../../shared/types/physlive";
import axios from "axios";
import { topicLabel } from "../../../shared/lib/topicLabel";

type Props = {
  simulation: GeneratedSimulationResult;
  parameters: Record<string, number>;
  folders: LibraryFolder[];
  onFolder: (folder: LibraryFolder) => void;
  onSaved: (item: LibraryItem) => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
};

const TITLE_LENGTH = 100;

/**
 * A short name proposed from the description: its first paragraph (what the teacher wrote; corrections are appended
 * below it), cut at a word boundary. The teacher can rename it before saving.
 */
const suggestedTitle = (description: string) => {
  const first = description.split(/\n\s*\n/)[0].replaceAll(/\s+/g, " ").trim();
  if (first.length <= TITLE_LENGTH) return first;
  const cut = first.slice(0, TITLE_LENGTH);
  const space = cut.lastIndexOf(" ");
  return `${(space > TITLE_LENGTH / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

export default function SaveSimulationPanel({ simulation, parameters, folders, onFolder, onSaved, onClose, onBusyChange }: Props) {
  const [title, setTitle] = useState(() => suggestedTitle(simulation.description));
  const [folderId, setFolderId] = useState(folders[0]?.id ?? "");
  const [folderName, setFolderName] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [catalog, setCatalog] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (!cancelled) {
        setLoading(false);
        setError("Tải bài học quá thời gian chờ (10 giây). Kiểm tra kết nối mạng rồi nhấn Tải lại bài học.");
      }
    }, 10000);
    simulationCurriculum(simulation.schemaId, simulation.schemaVersion, controller.signal)
      .then(value => { if (!cancelled && !controller.signal.aborted) setCatalog(value); })
      .catch(cause => {
        if (!cancelled && !controller.signal.aborted) setError(axios.isAxiosError<{ message?: string }>(cause)
          ? cause.response?.data?.message ?? "Chưa tải được danh sách bài học. Vui lòng thử lại."
          : "Chưa tải được danh sách bài học. Vui lòng thử lại.");
      })
      .finally(() => window.clearTimeout(timeout))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; window.clearTimeout(timeout); controller.abort(); };
  }, [reload, simulation.schemaId, simulation.schemaVersion]);
  const topic = catalog?.topics.map(item => topicLabel(item.name)).join(", ") ?? "";
  const topics = catalog?.topics.filter(item => item.enabled) ?? [];
  const lessons = topics.flatMap(t => t.modules.flatMap(m => m.levels.flatMap(l => l.lessons.map(lesson => ({
    id: lesson.id, label: `${m.name} / ${l.name} / ${lesson.name}`, name: lesson.name, path: `${m.name} · ${l.name}`,
  })))));
  // never make the teacher hunt for a lesson: preselect the one whose name shares most words with the description
  const suggestedLesson = (() => {
    if (!lessons.length) return "";
    const words = new Set(simulation.description.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2));
    let best = lessons[0], bestScore = -1;
    for (const lesson of lessons) {
      const name = lesson.name.toLowerCase();
      // the lesson named word for word in the description wins; otherwise the share of its words found there
      const parts = name.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2);
      const score = (simulation.description.toLowerCase().includes(name) ? 10 : 0)
        + (parts.length ? parts.filter(w => words.has(w)).length / parts.length : 0);
      if (score > bestScore) { best = lesson; bestScore = score; }
    }
    return best.id;
  })();
  if (!lessonId && suggestedLesson) setLessonId(suggestedLesson);
  const status = simulation.validation?.status ?? "";
  const warning = status === "FLAGGED"
    ? { tone: "warn", text: "Một số kết quả chưa khớp định luật. Bạn vẫn lưu và dùng được; mô phỏng sẽ mang nhãn “Cần kiểm tra lại” để bạn xem lại sau." }
    : status === "VERIFIED_PARTLY" || status === "ILLUSTRATIVE" || status === "VISUAL_ONLY_UNVERIFIED"
      ? { tone: "info", text: "Một vài đại lượng chưa có định luật đối chiếu. Mô phỏng vẫn lưu bình thường và mang nhãn tương ứng." }
      : null;
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (loading || !lessons.some(lesson => lesson.id === lessonId)) {
      setError("Vui lòng chọn bài học trong danh sách trước khi lưu.");
      return;
    }
    setBusy(true); onBusyChange(true); setError("");
    try {
      let target = folderId;
      if (!target) {
        const folder = await createLibraryFolder(folderName.trim());
        target = folder.id; setFolderId(target); onFolder(folder);
      }
      const item = await saveGeneratedSimulation(simulation, parameters, title.trim(), target, lessonId);
      onSaved(item);
    } catch (cause) {
      setError(axios.isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message ?? "Chưa lưu được mô phỏng. Vui lòng thử lại."
        : "Chưa lưu được mô phỏng. Vui lòng thử lại.");
    } finally { setBusy(false); onBusyChange(false); }
  };
  return <form className="simulation-save-panel" onSubmit={save} aria-label="Lưu mô phỏng vào thư viện">
    <header className="save-head">
      <h3>Lưu mô phỏng</h3>
      <p>Cảnh minh họa và các thông số hiện tại được lưu vào thư viện của bạn để mở lại hoặc giao bài.</p>
    </header>
    {warning && <p className={`save-note save-note-${warning.tone}`} role="status">{warning.text}</p>}
    <fieldset className="save-fields" disabled={busy}>
      <label className="save-field"><span>Tên bài</span><input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label>
      <label className="save-field"><span>Thư mục</span><select value={folderId} onChange={e => setFolderId(e.target.value)}>
        <option value="">Tạo thư mục mới…</option>
        {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
      </select></label>
      {!folderId && <label className="save-field"><span>Tên thư mục mới</span><input required maxLength={120} value={folderName} placeholder="Ví dụ: Điện xoay chiều" onChange={e => setFolderName(e.target.value)} /></label>}
      <fieldset className="simulation-lesson-picker" disabled={loading}>
        <legend>Bài học {topic && <small>· {topic}</small>}</legend>
        {loading ? <p className="save-muted" role="status">Đang tải bài học…</p> : <div className="simulation-lesson-options" role="radiogroup">
          {lessons.map(lesson => <label key={lesson.id} className="simulation-lesson-option">
            <input type="radio" name="simulation-lesson" required value={lesson.id}
              checked={lessonId === lesson.id} onChange={() => setLessonId(lesson.id)} />
            <span><b>{lesson.name}</b><small>{lesson.path}</small></span>
          </label>)}
        </div>}
        {!loading && catalog && !lessons.length && <p className="save-muted" role="status">Chưa có bài học đang hoạt động cho chủ đề này.</p>}
        {!loading && (!catalog || !lessons.length) && <button type="button" className="save-link" onClick={() => { setLoading(true); setCatalog(null); setLessonId(""); setError(""); setReload(n => n + 1); }}>Tải lại bài học</button>}
      </fieldset>
      {error && <p className="save-note save-note-error" role="alert">{error}</p>}
    </fieldset>
    <div className="simulation-actions save-actions">
      <button type="button" onClick={onClose} disabled={busy}>Hủy</button>
      <button type="submit" className="simulation-primary-button" disabled={busy || loading}>{busy ? "Đang lưu…" : "Lưu vào thư viện"}</button>
    </div>
  </form>;
}
