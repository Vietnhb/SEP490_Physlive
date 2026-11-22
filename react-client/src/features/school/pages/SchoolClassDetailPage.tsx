import { useResource } from "../../../shared/hooks/operationsData";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertDialog, Avatar, Badge, Button, Popover, Select, Table, TextField } from "@radix-ui/themes";
import { ArrowLeftIcon, CheckIcon, ChevronDownIcon, DownloadIcon, MagnifyingGlassIcon, PersonIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  assignClassTeacher,
  replaceClassTeacher,
  downloadSchoolClassStudentsCsv,
  enrollClassStudent,
  removeClassStudent,
  removeClassTeacher,
  transferClassStudent,
  updateSchoolClass,
} from "../api/schoolApi";
import type { SchoolClassDetail, SchoolClassRequest, SchoolClassSummary } from "../types";
import type { User } from "../../../shared/auth/types";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { apiMessage } from "../../../shared/lib/apiError";
import { usePageBreadcrumb } from "../../../shared/layout/PageBreadcrumbContext";
import { ClassDetailLoading } from "../components/SchoolLoading";
import SchoolClassGrades from "../components/SchoolClassGrades";
import SchoolAccountProfileDialog from "../../account/components/SchoolAccountProfileDialog";
import s from "../components/SchoolClasses.module.css";
import layout from "./SchoolClassDetailPage.module.css";

function MemberAvatar({ name, src, onOpen }: Readonly<{ name: string; src?: string | null; onOpen: () => void }>) {
  return <button type="button" className={layout.avatarButton} aria-label={"Xem ảnh và hồ sơ của " + name} title={"Xem hồ sơ " + name} onClick={onOpen}><Avatar size="3" radius="full" src={src || undefined} alt="" fallback={<PersonIcon width="22" height="22" aria-hidden="true" />} /></button>;
}

type Option = { value: string; label: string };
type Feedback = { type: "success" | "error"; message: string };
const searchable = (value: string) => value.normalize("NFD").replaceAll(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");

function AccountPicker({ value, disabled, label, placeholder, emptyLabel, options, onValueChange }: Readonly<{ value?: string; disabled?: boolean; label: string; placeholder: string; emptyLabel: string; options: Option[]; onValueChange: (value: string) => void }>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find(option => option.value === value);
  const needle = searchable(query.trim());
  const filtered = needle ? options.filter(option => searchable(option.label).includes(needle)) : options;
  return <Popover.Root open={open} onOpenChange={next => { setOpen(next); if (!next) setQuery(""); }}>
    <Popover.Trigger><Button type="button" variant="surface" color="gray" className="admin-search-picker-trigger" disabled={disabled} aria-label={label} aria-expanded={open}><span>{selected?.label ?? placeholder}</span><ChevronDownIcon /></Button></Popover.Trigger>
    <Popover.Content className="admin-search-picker-content" align="start" sideOffset={6} collisionPadding={16}>
      <TextField.Root autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc email…" aria-label={`Tìm trong ${label.toLocaleLowerCase("vi")}`}><TextField.Slot><MagnifyingGlassIcon /></TextField.Slot></TextField.Root>
      <div className="admin-search-picker-options" role="listbox" aria-label={label}>{filtered.length === 0 ? <p>{emptyLabel}</p> : filtered.map(option => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onClick={() => { onValueChange(option.value); setOpen(false); setQuery(""); }}><span>{option.label}</span>{option.value === value && <CheckIcon />}</button>)}</div>
      <small>{filtered.length}/{options.length} tài khoản</small>
    </Popover.Content>
  </Popover.Root>;
}

export default function SchoolClassDetailPage() {
  const navigate = useNavigate();
  const { classId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const editMode = searchParams.get("mode") === "edit";
  const gradeMode = searchParams.get("view") === "grades";
  const schoolId = useSessionStore(state => state.user?.schoolId);
  const setPageBreadcrumb = usePageBreadcrumb();
  const [teacherId, setTeacherId] = useState("");
  const [replacement, setReplacement] = useState<{ teacherId: number; teacherName: string; previousId: number; previousName: string } | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentPageSize, setStudentPageSize] = useState(10);
  const [studentPage, setStudentPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionError, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ studentId: number; studentName: string; classId: string; className: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ kind: "teacher" | "student"; id: number; name: string } | null>(null);

  const base = "/schools/" + schoolId + "/classes";
  const detailResource = useResource<SchoolClassDetail>(base + "/" + classId, Boolean(schoolId && classId));
  const classesResource = useResource<SchoolClassSummary[]>(base + "?includeInactive=false", Boolean(schoolId && editMode));
  const usersResource = useResource<User[]>("/schools/" + schoolId + "/users", Boolean(schoolId && editMode));
  const detail = detailResource.data ?? null;
  const classes = classesResource.data ?? [];
  const users = useMemo(() => usersResource.data ?? [], [usersResource.data]);
  const loading = detailResource.loading || (editMode && (classesResource.loading || usersResource.loading));
  const error = actionError || detailResource.error || (editMode && (classesResource.error || usersResource.error)) || "";
  const [draft, setDraft] = useState<{ key: string; value: SchoolClassRequest } | null>(null);
  const formKey = schoolId + "/" + classId;
  const form = draft?.key === formKey ? draft.value : detail ? { name: detail.name, gradeLevel: detail.gradeLevel, schoolYear: detail.schoolYear, subject: detail.subject ?? "" } : null;
  const setForm = (value: SchoolClassRequest) => setDraft({ key: formKey, value });
  const load = () => { setError(""); return Promise.all([detailResource.refresh(), ...(editMode ? [classesResource.refresh(), usersResource.refresh()] : [])]); };

  useEffect(() => {
    if (detail?.name) setPageBreadcrumb(gradeMode ? `${detail.name} · Bảng điểm` : detail.name);
    return () => setPageBreadcrumb(undefined);
  }, [detail?.name, gradeMode, setPageBreadcrumb]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const teachers = useMemo(() => users.filter(item => item.role === "STAFF" && item.active !== false), [users]);
  const students = useMemo(() => users.filter(item => item.role === "STUDENT" && item.active !== false), [users]);
  const filteredStudents = (detail?.students ?? []).filter(student => searchable(student.fullName + " " + student.email).includes(searchable(studentQuery.trim())));
  const pageCount = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const currentPage = Math.min(studentPage, pageCount);
  const pageStart = (currentPage - 1) * studentPageSize;
  const visibleStudents = filteredStudents.slice(pageStart, pageStart + studentPageSize);

  const runAction = async (work: () => Promise<unknown>, successMessage: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setFeedback(null);
    try {
      await work();
      await load();
      setFeedback({ type: "success", message: successMessage });
    } catch (err) {
      const message = apiMessage(err, "Không thể cập nhật lớp học.");
      setError(message);
      setFeedback({ type: "error", message });
    } finally {
      setBusy(false);
    }
  };

  const saveClass = (event: FormEvent) => {
    event.preventDefault();
    if (!schoolId || !classId || !form) return;
    void runAction(() => updateSchoolClass(schoolId, classId, form), "Đã lưu thông tin lớp học.");
  };

  const exportStudents = async () => {
    if (!schoolId || !detail || exporting || busy) return;
    setExporting(true); setFeedback(null);
    try {
      await downloadSchoolClassStudentsCsv(schoolId, detail.id, detail.name, detail.schoolYear);
      setFeedback({ type: "success", message: "Đã tải CSV toàn bộ danh sách học sinh của lớp." });
    } catch (cause) {
      setFeedback({ type: "error", message: apiMessage(cause, "Không thể xuất danh sách học sinh. Vui lòng thử lại.") });
    } finally { setExporting(false); }
  };

  const changeMode = (editing: boolean) => setSearchParams(editing ? { mode: "edit" } : {}, { replace: true });

  if (!schoolId || !classId) return null;

  return <div className={"admin-content " + layout.page} data-class-mode={editMode ? "edit" : gradeMode ? "grades" : "view"}>
    {profileId !== null && <SchoolAccountProfileDialog schoolId={schoolId} userId={profileId} onClose={() => setProfileId(null)} />}
    <header className={layout.header}>
      <Button variant="ghost" color="gray" className={layout.back} onClick={() => navigate("/school/classes")}><ArrowLeftIcon />Quản lý lớp học</Button>
      <div className={layout.classHeading}>{!editMode && detail && <div><h2>{detail.name}</h2><p>Khối {detail.gradeLevel} · {detail.schoolYear} · {detail.subject || "Chưa cập nhật môn học"}</p></div>}<div className={layout.headerActions}>{!editMode && detail && <Badge color={detail.active === false ? "gray" : "green"}>{detail.active === false ? "Ngừng hoạt động" : "Hoạt động"}</Badge>}{!gradeMode && <Button variant={editMode ? "soft" : "solid"} onClick={() => changeMode(!editMode)}>{editMode ? "Đóng chỉnh sửa" : <><Pencil1Icon />Chỉnh sửa</>}</Button>}</div></div>
      <nav className={layout.tabs} aria-label="Nội dung lớp học"><button type="button" aria-current={!gradeMode ? "page" : undefined} onClick={() => setSearchParams({})}>Thành viên lớp</button><button type="button" aria-current={gradeMode ? "page" : undefined} onClick={() => setSearchParams({ view: "grades" })}>Bảng điểm</button></nav>
    </header>
    {error && <div className="admin-error-banner" role="alert">{error}<Button variant="soft" color="red" onClick={() => void load()}>Tải lại</Button></div>}
    {feedback && <div className={`${s.feedbackToast} ${feedback.type === "success" ? s.feedbackSuccess : s.feedbackError}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.message}</div>}
    {loading && !gradeMode && <ClassDetailLoading />}

    {gradeMode && <SchoolClassGrades key={classId} schoolId={schoolId} classId={classId} embedded />}
    {!gradeMode && !loading && detail && <section className={layout.content}>


      {editMode && form ? <form className={`admin-form-grid ${s.editForm}`} onSubmit={saveClass} aria-labelledby="detail-class-heading">
        <div className={`${s.editFormFields} ${layout.fields}`}>
          <div className={`${s.sectionHeading} ${s.classFormHeading}`}><h3 id="detail-class-heading">Lớp</h3></div>
          <label><span className={s.fieldLabel}>Tên lớp</span><TextField.Root required maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
          <label><span className={s.fieldLabel}>Khối</span><Select.Root value={String(form.gradeLevel)} onValueChange={value => setForm({ ...form, gradeLevel: Number(value) })}><Select.Trigger /><Select.Content position="popper" side="bottom" align="start" sideOffset={6} className={s.gradeSelectContent}>{[10, 11, 12].map(value => <Select.Item key={value} value={String(value)}>Khối {value}</Select.Item>)}</Select.Content></Select.Root></label>
          <label><span className={s.fieldLabel}>Năm học</span><TextField.Root required maxLength={20} value={form.schoolYear} onChange={event => setForm({ ...form, schoolYear: event.target.value })} /></label>
          <label><span className={s.fieldLabel}>Môn học</span><TextField.Root maxLength={50} value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} /></label>
        </div>
        <div className="admin-form-actions"><Button type="submit" loading={busy} disabled={busy}>Lưu thông tin lớp</Button></div>
      </form> : null}

      <section className={`${s.memberSection} ${layout.teacherSection} ${editMode ? s.editSection : ""}`} aria-labelledby="detail-teachers-heading">
        <div className={s.sectionHeading}><h3 id="detail-teachers-heading">Giáo viên</h3></div>
        {editMode && <div className="admin-member-add"><AccountPicker value={teacherId} disabled={busy || detail.teachers.length > 1} label={detail.teachers.length ? "Chọn giáo viên thay thế" : "Chọn giáo viên"} placeholder={detail.teachers.length ? "Chọn giáo viên thay thế" : "Chọn giáo viên"} emptyLabel="Không tìm thấy giáo viên phù hợp." options={teachers.filter(user => !detail.teachers.some(item => item.id === user.id)).map(user => ({ value: String(user.id), label: `${user.fullName} · ${user.email}` }))} onValueChange={setTeacherId} /><Button variant="soft" disabled={!teacherId || busy || detail.teachers.length > 1} onClick={() => { if (detail.teachers.length === 1) { const teacher = teachers.find(item => item.id === Number(teacherId)); if (teacher) { setError(""); setReplacement({ teacherId: teacher.id, teacherName: teacher.fullName, previousId: detail.teachers[0].id, previousName: detail.teachers[0].fullName }); } } else void runAction(async () => { await assignClassTeacher(schoolId, detail.id, Number(teacherId)); setTeacherId(""); }, "Đã phân công giáo viên."); }}>{detail.teachers.length ? "Thay giáo viên" : "Phân công"}</Button></div>}
        {detail.teachers.length > 1 && <div className="admin-error-banner" role="alert">Lớp có nhiều giáo viên từ phân công cũ. Hãy gỡ các phân công dư để chỉ giữ lại một giáo viên.</div>}
        {detail.teachers.length === 0 ? <p className={s.empty}>Lớp chưa có giáo viên được phân công.</p> : <ul className={editMode ? s.manageList : s.teacherList}>{detail.teachers.map(item => <li key={item.id}><MemberAvatar name={item.fullName} src={item.avatarUrl} onOpen={() => setProfileId(item.id)} /><div><strong><button type="button" className={s.profileName} aria-label={"Xem hồ sơ " + item.fullName} onClick={() => setProfileId(item.id)}>{item.fullName}</button></strong><small>{item.email}</small></div>{editMode && <Button size="1" variant="soft" color="red" disabled={busy} onClick={() => setRemoveTarget({ kind: "teacher", id: item.id, name: item.fullName })}>Gỡ</Button>}</li>)}</ul>}
      </section>

      <section className={`${s.memberSection} ${layout.studentSection} ${editMode ? s.editSection : ""}`} aria-labelledby="detail-students-heading">
        <div className={s.sectionHeading}><h3 id="detail-students-heading">Học sinh</h3><div className={s.sectionActions}><Button type="button" size="2" variant="soft" loading={exporting} disabled={busy || exporting || detail.students.length === 0} title={detail.students.length ? "Xuất toàn bộ học sinh của lớp, gồm cả các trang khác" : "Lớp chưa có học sinh để xuất"} onClick={() => void exportStudents()}><DownloadIcon />Xuất danh sách học sinh</Button></div></div>
        {editMode && <div className="admin-member-add"><AccountPicker value={studentId} disabled={busy} label="Chọn học sinh" placeholder="Chọn học sinh" emptyLabel="Không tìm thấy học sinh phù hợp." options={students.filter(user => !detail.students.some(item => item.id === user.id)).map(user => ({ value: String(user.id), label: `${user.fullName} · ${user.email}` }))} onValueChange={setStudentId} /><Button variant="soft" color="cyan" disabled={!studentId || busy} onClick={() => void runAction(async () => { await enrollClassStudent(schoolId, detail.id, Number(studentId)); setStudentId(""); }, "Đã thêm học sinh vào lớp.")}>Thêm vào lớp</Button></div>}
        <div className={layout.studentSearch}><TextField.Root aria-label="Tìm học sinh trong lớp" placeholder="Tìm tên hoặc email học sinh…" value={studentQuery} onChange={event => { setStudentQuery(event.target.value); setStudentPage(1); }}><TextField.Slot><MagnifyingGlassIcon /></TextField.Slot></TextField.Root><span>{filteredStudents.length} học sinh</span></div>
        {detail.students.length === 0 ? <p className={s.empty}>Lớp chưa có học sinh.</p> : <>
          <div className={s.studentTableScroll} role="region" aria-labelledby="detail-students-heading"><Table.Root size="2" variant="surface"><Table.Header><Table.Row><Table.ColumnHeaderCell>STT</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Họ và tên</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>{editMode && <Table.ColumnHeaderCell className={s.actionColumn}>Thao tác</Table.ColumnHeaderCell>}</Table.Row></Table.Header><Table.Body>{visibleStudents.map((item, index) => <Table.Row key={item.id}><Table.Cell>{pageStart + index + 1}</Table.Cell><Table.RowHeaderCell><div className={layout.studentIdentity}><MemberAvatar name={item.fullName} src={item.avatarUrl} onOpen={() => setProfileId(item.id)} /><button type="button" className={s.profileName} aria-label={"Xem hồ sơ " + item.fullName} onClick={() => setProfileId(item.id)}>{item.fullName}</button></div></Table.RowHeaderCell><Table.Cell>{item.email}</Table.Cell>{editMode && <Table.Cell><div className={s.studentActions}><Select.Root disabled={busy} onValueChange={targetId => { const target = classes.find(candidate => candidate.id === targetId); if (target) setTransferTarget({ studentId: item.id, studentName: item.fullName, classId: target.id, className: target.name }); }}><Select.Trigger className={s.transferSelect} placeholder="Chuyển lớp…" aria-label={`Chuyển lớp cho ${item.fullName}`} /><Select.Content>{classes.filter(candidate => candidate.id !== detail.id && candidate.schoolYear === detail.schoolYear).map(candidate => <Select.Item key={candidate.id} value={candidate.id}>{candidate.name}</Select.Item>)}</Select.Content></Select.Root><Button size="1" variant="soft" color="red" disabled={busy} onClick={() => setRemoveTarget({ kind: "student", id: item.id, name: item.fullName })}>Gỡ</Button></div></Table.Cell>}</Table.Row>)}{visibleStudents.length === 0 && <Table.Row><Table.Cell colSpan={editMode ? 4 : 3}><p className={s.empty}>Không tìm thấy học sinh phù hợp.</p></Table.Cell></Table.Row>}</Table.Body></Table.Root></div>
          <div className={s.studentFooter}><Select.Root size="1" value={String(studentPageSize)} onValueChange={value => { setStudentPageSize(Number(value)); setStudentPage(1); }}><Select.Trigger aria-label="Số học sinh trên mỗi trang" /><Select.Content>{[10, 20, 30].map(size => <Select.Item key={size} value={String(size)}>{size} dòng</Select.Item>)}</Select.Content></Select.Root><div className={`${s.pagination} ${s.compactPagination}`}><span>Hiển thị {filteredStudents.length ? pageStart + 1 : 0}–{Math.min(pageStart + studentPageSize, filteredStudents.length)} / {filteredStudents.length}</span><div><Button size="1" variant="soft" color="gray" disabled={currentPage <= 1} onClick={() => setStudentPage(Math.max(1, currentPage - 1))}>Trước</Button><span>Trang {currentPage}/{pageCount}</span><Button size="1" variant="soft" color="gray" disabled={currentPage >= pageCount} onClick={() => setStudentPage(Math.min(pageCount, currentPage + 1))}>Sau</Button></div></div></div>
        </>}
      </section>
    </section>}
    <AlertDialog.Root open={!!replacement} onOpenChange={open => { if (!open && !busy) setReplacement(null); }}><AlertDialog.Content maxWidth="560px">
      <AlertDialog.Title>Thay giáo viên phụ trách</AlertDialog.Title>
      <AlertDialog.Description>Thay {replacement?.previousName} bằng {replacement?.teacherName} cho lớp {detail?.name}?</AlertDialog.Description>
      <ul><li>Bài thực hành, bài nộp, điểm và nhận xét của lớp được giữ nguyên.</li><li>Giáo viên mới tiếp nhận quyền quản lý và chấm bài, kể cả bài do giáo viên cũ giao.</li><li>Giáo viên cũ mất quyền truy cập dữ liệu riêng của lớp; thư viện cá nhân vẫn được giữ.</li></ul>
      {error && <p className="admin-error-banner" role="alert">{error}</p>}
      <div className="admin-form-actions"><AlertDialog.Cancel><Button variant="soft" color="gray" disabled={busy}>Hủy</Button></AlertDialog.Cancel><Button disabled={busy} loading={busy} onClick={() => { if (replacement) void runAction(async () => { await replaceClassTeacher(schoolId, classId, replacement.teacherId, replacement.previousId); setReplacement(null); setTeacherId(""); }, "Đã thay giáo viên. Dữ liệu lớp được giữ nguyên và quyền truy cập đã cập nhật."); }}>Xác nhận thay giáo viên</Button></div>
    </AlertDialog.Content></AlertDialog.Root>
    <AlertDialog.Root open={!!removeTarget} onOpenChange={open => { if (!open && !busy) setRemoveTarget(null); }}><AlertDialog.Content maxWidth="480px"><AlertDialog.Title>{removeTarget?.kind === "teacher" ? "Gỡ giáo viên khỏi lớp" : "Gỡ học sinh khỏi lớp"}</AlertDialog.Title><AlertDialog.Description>{removeTarget?.kind === "teacher" ? `Gỡ ${removeTarget?.name} khỏi lớp ${detail?.name ?? ""}? Lớp sẽ chưa có giáo viên phụ trách cho đến khi bạn phân công người khác.` : `Gỡ ${removeTarget?.name} khỏi lớp ${detail?.name ?? ""}? Học sinh sẽ không còn nhận bài tập mới của lớp này.`}</AlertDialog.Description><div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}><AlertDialog.Cancel><Button color="gray" variant="soft" disabled={busy}>Hủy</Button></AlertDialog.Cancel><Button color="red" loading={busy} disabled={busy} onClick={() => { const target = removeTarget; if (target && detail) void runAction(async () => { await (target.kind === "teacher" ? removeClassTeacher(schoolId, detail.id, target.id) : removeClassStudent(schoolId, detail.id, target.id)); setRemoveTarget(null); }, target.kind === "teacher" ? "Đã gỡ giáo viên khỏi lớp." : "Đã gỡ học sinh khỏi lớp."); }}>Gỡ khỏi lớp</Button></div></AlertDialog.Content></AlertDialog.Root>
    <AlertDialog.Root open={!!transferTarget} onOpenChange={open => { if (!open && !busy) setTransferTarget(null); }}><AlertDialog.Content maxWidth="520px"><AlertDialog.Title>Xác nhận chuyển lớp</AlertDialog.Title><AlertDialog.Description>Chuyển {transferTarget?.studentName} sang lớp {transferTarget?.className}? Điểm và bài nộp ở lớp cũ được giữ nguyên. Học sinh vẫn hoàn thành bài cũ và được bổ sung các bài của lớp mới còn mở, chưa quá hạn.</AlertDialog.Description><div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}><AlertDialog.Cancel><Button color="gray" variant="soft" disabled={busy}>Hủy</Button></AlertDialog.Cancel><Button loading={busy} disabled={busy} onClick={() => { if (transferTarget) void runAction(async () => { await transferClassStudent(schoolId, transferTarget.classId, transferTarget.studentId); setTransferTarget(null); }, "Đã chuyển lớp. Điểm cũ được giữ nguyên và bài tập lớp mới đã được cập nhật."); }}>Xác nhận chuyển</Button></div></AlertDialog.Content></AlertDialog.Root>
  </div>;
}
