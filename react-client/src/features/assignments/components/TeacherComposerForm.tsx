import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AssignmentActivityType } from "../../../shared/types/physlive";
import { useAssignmentClock } from "../hooks/useAssignmentClock";
import { StudioIcon } from "./StudioIcon";
import SimulationPicker from "./SimulationPicker";
import { ACTIVITIES, STEPS, assignmentChecks, localDateTime, type TeacherAssignmentFormProps, measurableSeries, simulationEnd } from "./assignmentComposer";

type Node = { icon: string; title: string; text: string; tone: "brand" | "info" | "success" };
/** What a student goes through for each kind of activity (the "Học sinh sẽ trải qua" card of the canvas). */
const JOURNEY: Record<AssignmentActivityType, Node[]> = {
  PREDICT_OBSERVE_EXPLAIN: [
    { icon: "edit", title: "Đọc đề và ghi dự đoán", text: "Mô phỏng còn khóa", tone: "brand" },
    { icon: "atom", title: "Mô phỏng mở ra", text: "Học sinh quan sát, đổi thông số", tone: "info" },
    { icon: "file", title: "Viết kết luận", text: "So sánh với dự đoán ban đầu", tone: "info" },
    { icon: "check", title: "Thầy cô chấm", text: "Giá trị đúng từ mô phỏng hiện bên cạnh", tone: "success" },
  ],
  MEASUREMENT: [
    { icon: "atom", title: "Mô phỏng mở ngay", text: "Học sinh chạy thí nghiệm", tone: "brand" },
    { icon: "chart", title: "Đọc giá trị đo", text: "Tại thời điểm thầy cô chọn", tone: "info" },
    { icon: "file", title: "Giải thích kết quả", text: "Trả lời yêu cầu của bài", tone: "info" },
    { icon: "check", title: "Thầy cô chấm", text: "Giá trị đúng từ mô phỏng hiện bên cạnh", tone: "success" },
  ],
  PARAMETER_INVESTIGATION: [
    { icon: "sliders", title: "Thay đổi tham số", text: "Thử nhiều giá trị trong giới hạn", tone: "brand" },
    { icon: "chart", title: "Quan sát đại lượng", text: "Ghi lại cách đại lượng thay đổi", tone: "info" },
    { icon: "file", title: "Rút ra quy luật", text: "Giải thích bằng kiến thức đã học", tone: "info" },
    { icon: "check", title: "Thầy cô chấm", text: "Xem lại quá trình và kết luận", tone: "success" },
  ],
  FREE_EXPLORATION: [
    { icon: "atom", title: "Mô phỏng mở ngay", text: "Học sinh tự do thí nghiệm", tone: "brand" },
    { icon: "eye", title: "Quan sát hiện tượng", text: "Đổi thông số, theo dõi kết quả", tone: "info" },
    { icon: "file", title: "Viết kết luận", text: "Ghi lại điều rút ra được", tone: "info" },
    { icon: "check", title: "Thầy cô chấm", text: "Chấm theo bài làm", tone: "success" },
  ],
};
const TONE = { brand: { "--ic": "var(--brand-text)", "--ic-bg": "var(--brand-soft)" }, info: { "--ic": "var(--info)", "--ic-bg": "var(--info-soft)" }, success: { "--ic": "var(--success)", "--ic-bg": "var(--success-soft)" } } as Record<Node["tone"], React.CSSProperties>;

/**
 * The "Giao bài mới" composer in the design canvas's markup (artboard TeacherComposer): page header, stepper, the
 * step's card and an aside with what is still missing and what students will go through. Same props and the same
 * checks as the Radix form, so creating an assignment behaves exactly as before.
 */
export default function TeacherComposerForm(props: Readonly<TeacherAssignmentFormProps>) {
  const {
    saved, selectedLibrary, libraryItemId, title, description, prompt, activityType, simulation,
    simulationOptionsLoading, simulationOptionsError, targetSeriesSource, sampleTime, measurementTolerance,
    investigationParameter, investigationOutcome, maxScore, dueAt, allowLateSubmission, onAllowLateSubmissionChange, students, classes, selectedClassId, selectedStudents,
    submitting, onSubmit, onLibraryChange, onTitleChange, onPromptChange, onActivityTypeChange, onTargetSeriesSourceChange,
    onSampleTimeChange, onMeasurementToleranceChange, onInvestigationParameterChange, onInvestigationOutcomeChange,
    onMaxScoreChange, onDueAtChange, onDescriptionChange, onToggleStudent, onSelectAll, onClassChange,
  } = props;
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const now = useAssignmentClock();
  const series = measurableSeries(simulation);
  const controls = simulation?.visualization?.controls ?? [];
  const activity = ACTIVITIES.find(item => item.value === activityType) ?? ACTIVITIES[0];
  const { typeConfigValid, contentValid, dueInPast, recipientsValid } = assignmentChecks(props, now);
  const selectedClass = classes.find(item => item.id === selectedClassId);
  const shownStudents = students.filter(student => student.fullName.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi")));
  const wholeClass = students.length > 0 && selectedStudents.length === students.length;
  const goTo = (next: number) => { if (next <= step || (step === 0 ? contentValid : recipientsValid)) setStep(next); };
  const todo = [
    { label: "Chọn mô phỏng", done: Boolean(selectedLibrary) },
    { label: "Nhập tiêu đề", done: Boolean(title.trim()) },
    { label: "Nhập yêu cầu cho học sinh", done: Boolean(prompt.trim()) },
    ...(activityType === "MEASUREMENT" || activityType === "PARAMETER_INVESTIGATION" ? [{ label: activityType === "MEASUREMENT" ? "Cấu hình phép đo" : "Chọn tham số khảo sát", done: typeConfigValid }] : []),
    { label: "Chọn lớp", done: Boolean(selectedClassId) },
    { label: "Chọn ít nhất một học sinh", done: selectedStudents.length > 0 },
  ];
  const missing = todo.slice(0, step === 0 ? todo.length - 2 : undefined).filter(item => !item.done).map(item => item.label.toLocaleLowerCase("vi"));
  const field = (id: string) => ({ id, className: "input" });

  if (saved.length === 0) return <section className="card" aria-label="Chưa có mô phỏng">
    <div className="empty"><img src="/studio/il-empty.svg" alt="" style={{ width: 180, height: 120, objectFit: "contain" }} />
      <b style={{ color: "var(--text)", fontSize: 15 }}>Chưa có mô phỏng nào để giao</b>
      <span>Hãy dựng một mô phỏng rồi chọn “Lưu vào thư viện”. Chỉ mô phỏng đã kiểm định mới giao được cho học sinh.</span>
      <Link className="btn btn-primary" to="/workspace" style={{ marginTop: 10 }}><StudioIcon name="plus" />Tạo mô phỏng</Link></div>
  </section>;

  return <form noValidate className="composer" onSubmit={event => { if (step < 2) { event.preventDefault(); goTo(step + 1); } else if (contentValid && recipientsValid) onSubmit(event); else { event.preventDefault(); setStep(contentValid ? 1 : 0); } }}>
    <ol className="stepper" aria-label="Các bước giao bài">{STEPS.map((label, index) =>
      <li key={label} data-state={index < step ? "done" : index === step ? "current" : undefined}>
        <button type="button" className="stepper-go" aria-current={index === step ? "step" : undefined}
          disabled={index > step && !(index === step + 1 && (step === 0 ? contentValid : recipientsValid))} onClick={() => goTo(index)}>{index + 1} · {label}</button>
      </li>)}</ol>
    <div className="split">
      <section className="card" style={{ flex: "1 1 560px", minWidth: 0 }} aria-label={STEPS[step]}>
        <fieldset className="card-b form" disabled={submitting} hidden={step !== 0}>
          <div className="field"><label htmlFor="assignment-library-item" className="field-label">Mô phỏng</label>
            <SimulationPicker items={saved} value={libraryItemId} onChange={onLibraryChange} disabled={submitting} />
            <span className="hint">Mô phỏng mang nhãn “Cần kiểm tra lại” vẫn giao được; bài đo lấy giá trị của mô phỏng làm đáp án tham khảo, giáo viên chấm mọi bài.</span>
            {simulationOptionsLoading && <span className="hint" role="status">Đang đọc các đại lượng và tham số của mô phỏng…</span>}
            {simulationOptionsError && <span className="err" role="alert"><StudioIcon name="alert" />Không mở được mô phỏng này để giao. Hãy chọn mô phỏng khác, hoặc mở lại nó ở trang Mô phỏng để kiểm tra.</span>}
          </div>
          <fieldset className="form composer-kinds">
            <legend className="field"><span>Hình thức hoạt động</span></legend>
            <div className="form-row composer-kind-grid" role="radiogroup" aria-label="Hình thức hoạt động">{ACTIVITIES.map(item =>
              <button key={item.value} type="button" className="choice" role="radio" aria-checked={activityType === item.value} onClick={() => onActivityTypeChange(item.value)}>
                <span className="radio" /><span><b>{item.label}</b><small>{item.help}</small></span>
              </button>)}</div>
          </fieldset>
          <label className="field"><span>Tiêu đề bài</span>
            <input {...field("assignment-title")} maxLength={160} value={title} placeholder="Ví dụ: Ném ngang – dự đoán vận tốc chạm đất" onChange={event => onTitleChange(event.target.value)} /></label>
          <label className="field"><span>{activity.prompt}</span>
            <textarea {...field("assignment-prompt")} rows={3} value={prompt} placeholder="Ví dụ: Khi góc ném tăng từ 30° lên 45°, tầm xa tăng hay giảm? Vì sao?" onChange={event => onPromptChange(event.target.value)} />
            <span className="hint">{activityType === "PREDICT_OBSERVE_EXPLAIN" ? "Học sinh gửi dự đoán trước, sau đó mô phỏng mới mở." : "Mô phỏng mở ngay để học sinh vừa thí nghiệm vừa trả lời."}</span></label>

          {activityType === "MEASUREMENT" && <div className="composer-config">
            <p className="eyebrow">Phép đo</p>
            <div className="form-row">
              <label className="field"><span>Đại lượng cần đo</span>
                <select {...field("measurement-series")} value={targetSeriesSource} disabled={series.length === 0} onChange={event => onTargetSeriesSourceChange(event.target.value)}>
                  <option value="">Chọn đại lượng</option>{series.map(item => <option key={item.source} value={item.source}>{item.label}{item.unit ? ` (${item.unit})` : ""}</option>)}</select></label>
              <label className="field"><span>Tại thời điểm (giây)</span>
                <input {...field("measurement-time")} type="number" min={0} max={simulationEnd(simulation)} step="any" value={sampleTime} onChange={event => onSampleTimeChange(event.target.value)} />
                {simulation && <span className="hint">Từ 0 đến {simulationEnd(simulation).toLocaleString("vi-VN")} s</span>}</label>
              <label className="field"><span>Sai số chấp nhận</span>
                <input {...field("measurement-tolerance")} type="number" min="0" step="any" value={measurementTolerance} onChange={event => onMeasurementToleranceChange(event.target.value)} />
                <span className="hint">Cùng đơn vị với đại lượng đo.</span></label>
            </div>
            {series.length === 0 && !simulationOptionsLoading && <span className="err" role="alert"><StudioIcon name="alert" />Mô phỏng này không có đại lượng nào để đo. Hãy chọn hình thức khác.</span>}
            <span className="hint">Giá trị đúng được lấy từ chính mô phỏng và hiện bên cạnh khi thầy cô chấm; học sinh không nhìn thấy.</span>
          </div>}
          {activityType === "PARAMETER_INVESTIGATION" && <div className="composer-config">
            <p className="eyebrow">Khảo sát</p>
            <div className="form-row">
              <label className="field"><span>Tham số học sinh thay đổi</span>
                <select {...field("investigation-parameter")} value={investigationParameter} disabled={controls.length === 0} onChange={event => onInvestigationParameterChange(event.target.value)}>
                  <option value="">Chọn tham số</option>{controls.map(item => <option key={item.key} value={item.key}>{item.label}{item.unit ? ` (${item.unit})` : ""}</option>)}</select></label>
              <label className="field"><span>Đại lượng cần quan sát</span>
                <select {...field("investigation-outcome")} value={investigationOutcome} disabled={series.length === 0} onChange={event => onInvestigationOutcomeChange(event.target.value)}>
                  <option value="">Không bắt buộc</option>{series.map(item => <option key={item.source} value={item.source}>{item.label}</option>)}</select></label>
            </div>
            {controls.length === 0 && !simulationOptionsLoading && <span className="err" role="alert"><StudioIcon name="alert" />Mô phỏng này không có tham số nào để thay đổi. Hãy chọn hình thức khác.</span>}
            <span className="hint">Học sinh được thử nhiều giá trị trong giới hạn của mô phỏng rồi giải thích quy luật.</span>
          </div>}

          <div className="form-row">
            <label className="field"><span>Thang điểm</span>
              <input {...field("assignment-max-score")} type="number" min="1" step="0.5" value={maxScore} aria-invalid={!(Number(maxScore) >= 0.001 && Number(maxScore) <= 99999.999)} onChange={event => onMaxScoreChange(event.target.value)} /></label>
            <label className="field"><span>Cách chấm</span><input className="input" readOnly value="Thầy cô chấm theo bài làm" /></label>
          </div>
        </fieldset>

        <fieldset className="card-b form" disabled={submitting} hidden={step !== 1}>
          <label className="field"><span>Lớp nhận bài</span>
            <select {...field("assignment-class")} value={selectedClassId} disabled={classes.length === 0} onChange={event => onClassChange(event.target.value)}>
              <option value="">Chọn lớp đang phụ trách</option>
              {classes.map(item => <option key={item.id} value={item.id}>Lớp {item.name} · Khối {item.gradeLevel} · {item.schoolYear} ({item.students.length} học sinh)</option>)}</select>
            {classes.length === 0 && <span className="hint">Bạn chưa được nhà trường phân công vào lớp nào.</span>}</label>
          <div className="form-row">
            <label className="field"><span>Hạn nộp</span>
              <input {...field("assignment-due-at")} type="datetime-local" min={localDateTime(now)} value={dueAt} aria-invalid={dueInPast} onChange={event => onDueAtChange(event.target.value)} />
              {dueInPast ? <span className="err" role="alert"><StudioIcon name="alert" />Hạn nộp phải ở tương lai.</span> : <span className="hint">Bỏ trống nếu không giới hạn.</span>}</label>
            <label className="field"><span>Lời dặn thêm</span>
              <input {...field("assignment-description")} placeholder="Không bắt buộc" value={description} onChange={event => onDescriptionChange(event.target.value)} /></label>
          </div>
          <div className="field">
            <label className="composer-check"><input type="checkbox" checked={allowLateSubmission} disabled={!dueAt} onChange={event => onAllowLateSubmissionChange(event.target.checked)} />Cho phép nộp trễ</label>
            <span className="hint">{!dueAt ? "Bài không có hạn nộp, học sinh có thể nộp bất kỳ lúc nào khi bài đang mở." : allowLateSubmission ? "Vẫn nhận bài sau hạn nộp và đánh dấu Nộp muộn. Giáo viên chấm điểm như bình thường." : "Đến hạn sẽ ngừng nhận bài. Học sinh chưa nộp bài hoàn chỉnh được ghi nhận 0 điểm."}</span>
          </div>
          <div className="field">
            <div className="composer-recipients-head">
              <span>Học sinh nhận bài <span className="hint" style={{ fontSize: 13 }}>({selectedStudents.length}/{students.length})</span></span>
              {students.length > 0 && <button type="button" className="btn btn-sm" onClick={onSelectAll}>{wholeClass ? "Bỏ chọn tất cả" : "Chọn cả lớp"}</button>}
            </div>
            {students.length > 0 && <label className="search"><StudioIcon name="search" /><input className="input" type="search" placeholder="Tìm học sinh…" aria-label="Tìm học sinh" value={search} onChange={event => setSearch(event.target.value)} /></label>}
            <div className="composer-recipients">
              {students.length === 0 ? <p className="hint" style={{ margin: 0, fontSize: 13 }}>{selectedClassId ? "Lớp này chưa có học sinh đang hoạt động." : "Chọn lớp để thấy danh sách học sinh."}</p>
                : shownStudents.length === 0 ? <p className="hint" style={{ margin: 0, fontSize: 13 }}>Không có học sinh khớp “{search}”.</p>
                : shownStudents.map(student => <label key={student.id} className="composer-check">
                  <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => onToggleStudent(student.id)} />{student.fullName}</label>)}
            </div>
          </div>
        </fieldset>

        {step === 2 && <div className="card-b form" aria-label="Xem lại bài giao">
          <span className="badge b-info" style={{ alignSelf: "flex-start" }}>{activity.label}</span>
          <h2 className="h2" style={{ margin: 0 }}>{title}</h2>
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{prompt}</p>
          {description && <p className="hint" style={{ margin: 0, fontSize: 14 }}>{description}</p>}
          <dl className="dl">
            <dt>Mô phỏng</dt><dd>{selectedLibrary?.title}</dd>
            <dt>Lớp</dt><dd>{selectedClass ? `${selectedClass.name} · Khối ${selectedClass.gradeLevel}` : "Chưa chọn"}</dd>
            <dt>Học sinh</dt><dd>{wholeClass ? `Cả lớp (${students.length})` : `${selectedStudents.length}/${students.length} học sinh`}</dd>
            <dt>Hạn nộp</dt><dd>{dueAt ? new Date(dueAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "Không giới hạn"}</dd>
            <dt>Nộp trễ</dt><dd>{!dueAt ? "Không giới hạn hạn nộp" : allowLateSubmission ? "Cho phép · Đánh dấu nộp muộn" : "Không cho phép · Quá hạn chưa nộp: 0 điểm"}</dd>
            <dt>Chấm điểm</dt><dd>Thầy cô chấm · thang {maxScore}</dd>
            {activityType === "MEASUREMENT" && <><dt>Phép đo</dt><dd>{series.find(item => item.source === targetSeriesSource)?.label} tại {sampleTime} s, sai số ±{measurementTolerance}</dd></>}
            {activityType === "PARAMETER_INVESTIGATION" && <><dt>Khảo sát</dt><dd>Thay đổi {controls.find(item => item.key === investigationParameter)?.label}{investigationOutcome ? `, quan sát ${series.find(item => item.source === investigationOutcome)?.label}` : ""}</dd></>}
            {!wholeClass && <><dt>Nhận bài</dt><dd>{students.filter(student => selectedStudents.includes(student.id)).map(student => student.fullName).join(", ")}</dd></>}
          </dl>
        </div>}

        <div className="card-f composer-actions">
          {step === 0 ? <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => navigate(-1)}>Hủy</button>
            : <button type="button" className="btn btn-ghost" disabled={submitting} onClick={() => setStep(step - 1)}>Quay lại</button>}
          {step < 2 && missing.length > 0 && <span className="hint composer-missing">Còn thiếu: {missing.join(", ")}.</span>}
          {/* separate keys: React must not turn the "Tiếp tục" being clicked into the submit button mid-click */}
          {step < 2 ? <button key="next" type="button" className="btn btn-primary" disabled={step === 0 ? !contentValid : !recipientsValid} onClick={() => goTo(step + 1)}>Tiếp tục<StudioIcon name="arrow" /></button>
            : <button key="send" type="submit" className="btn btn-primary" disabled={submitting || !contentValid || !recipientsValid || !libraryItemId}>{submitting ? "Đang giao…" : `Giao bài cho ${wholeClass ? "cả lớp" : `${selectedStudents.length} học sinh`}`}</button>}
        </div>
      </section>

      <aside className="card" style={{ flex: "0 1 300px", minWidth: 0 }} aria-label="Còn thiếu">
        <img src="/studio/il-assign.svg" alt="" style={{ display: "block", width: "100%", height: 150, objectFit: "contain", borderBottom: "1px solid var(--border)" }} />
        <div className="card-h"><h2 className="h2">Trước khi giao</h2></div>
        <ul className="rows">{todo.map(item => <li key={item.label} className="row" style={{ minHeight: 44 }}>
          <StudioIcon name={item.done ? "check" : "clock"} style={{ color: item.done ? "var(--success)" : "var(--text-3)" }} />
          <span className="row-t"><b style={{ fontWeight: 400 }}>{item.label}</b></span><span className="composer-sr">{item.done ? "đã xong" : "chưa xong"}</span></li>)}</ul>
        <div className="card-b" style={{ borderTop: "1px solid var(--border)" }}><p className="eyebrow" style={{ marginBottom: 10 }}>Học sinh sẽ trải qua</p>
          <div className="flow v">{JOURNEY[activityType].map((node, index) => <JourneyNode key={node.title} node={node} index={index} />)}</div></div>
      </aside>
    </div>
  </form>;
}

function JourneyNode({ node, index }: Readonly<{ node: Node; index: number }>) {
  return <>
    {index > 0 && <span className="edge" aria-hidden="true"><i style={{ animationDelay: `${index * 0.4}s` }} /></span>}
    <div className={"fnode" + (index === 0 ? " on" : "")}><span className="todo-ic" style={TONE[node.tone]}><StudioIcon name={node.icon} /></span>
      <span style={{ minWidth: 0 }}><b>{node.title}</b><small>{node.text}</small></span></div>
  </>;
}
