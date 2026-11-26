import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Dialog } from "radix-ui";
import { canTeach, departmentBase } from "../../../shared/auth/permissions";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import type { User } from "../../../shared/auth/types";
import { useResource } from "../../../shared/hooks/operationsData";
import { apiMessage } from "../../../shared/lib/apiError";
import PageActions from "../../../shared/layout/PageActions";
import StudioTableSkeleton from "../../assignments/components/StudioTableSkeleton";
import { useStudioPortal } from "../../assignments/components/useStudioPortal";
import { assignClassTeacher, enrollClassStudent, removeClassStudent, removeClassTeacher, replaceClassTeacher, transferClassStudent } from "../api/schoolApi";
import type { SchoolClassDetail, SchoolClassSummary } from "../types";

type Member = { id: number; fullName: string; email: string; avatarUrl?: string | null };
type Action =
  | { kind: "teacher" }
  | { kind: "students" }
  | { kind: "transfer"; student: Member }
  | { kind: "remove-teacher"; member: Member }
  | { kind: "remove-student"; member: Member };

const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();
const plain = (value: string) => value.normalize("NFD").replaceAll(/[̀-ͯ]/g, "").toLocaleLowerCase("vi");
const matches = (member: Member, query: string) => plain(member.fullName + " " + member.email).includes(plain(query.trim()));
const Avatar = ({ member, size = 32 }: { member: Member; size?: number }) => member.avatarUrl
  ? <img className="avatar" src={member.avatarUrl} alt="" loading="lazy" style={{ width: size, height: size, objectFit: "cover" }} />
  : <span className="avatar r-student" aria-hidden="true" style={{ width: size, height: size, fontSize: size > 30 ? 12 : 11 }}>{initials(member.fullName)}</span>;

/**
 * A class as the department head sees it: who teaches it and who studies in it. The head places teachers and students;
 * the class itself (name, grade, year, deleting it) stays with the school account.
 */
export default function DepartmentClassPage() {
  const { classId = "" } = useParams();
  const user = useSessionStore(state => state.user);
  const schoolId = user?.schoolId ?? "";
  const [host, setHost] = useState<HTMLElement | null>(null);
  const portal = useStudioPortal(host);
  const base = `/schools/${schoolId}/classes`;
  const detail = useResource<SchoolClassDetail>(`${base}/${classId}`, Boolean(schoolId && classId));
  const users = useResource<User[]>(`/schools/${schoolId}/users`, Boolean(schoolId));
  const classes = useResource<SchoolClassSummary[]>(`${base}?includeInactive=false`, Boolean(schoolId));
  const [action, setAction] = useState<Action | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const classroom = detail.data;
  const editable = classroom?.active !== false;
  const students = (classroom?.students ?? []).filter(member => matches(member, query));
  const pages = Math.max(1, Math.ceil(students.length / size));
  const current = Math.min(page, pages);
  const refresh = () => Promise.all([detail.refresh(), users.refresh(), classes.refresh()]);
  const done = (message: string) => { setAction(null); setNotice(message); void refresh(); };

  if (!schoolId) return null;
  return <main className="page" ref={setHost}>
    <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={detail.refreshing} onClick={() => void refresh()}>{icon("refresh")}Làm mới</button></PageActions>
    <Link className="btn btn-sm btn-ghost" to={`${departmentBase(user)}?tab=classes`} style={{ alignSelf: "flex-start", marginLeft: -8 }}>{icon("back")}Tổ bộ môn</Link>
    {detail.loading ? <section className="card"><StudioTableSkeleton headers={["Học sinh", "Email", ""]} label="Đang tải lớp…" /></section>
      : !classroom ? <section className="card"><div className="card-b" role="alert" style={{ display: "flex", gap: 12, alignItems: "center" }}>{detail.error || "Không tìm thấy lớp."}<button type="button" className="btn btn-sm" onClick={() => void detail.refresh()}>Thử lại</button></div></section>
      : <>
        <div className="ph ph-spot" style={{ "--spot": "url(/studio/il-classes.svg)" } as React.CSSProperties}><div>
          <span style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}><span className="badge b-brand plain">Phân công lớp</span><span className={"badge " + (editable ? "b-success" : "")}>{editable ? "Hoạt động" : "Đã xóa"}</span></span>
          <h1 className="h1">{classroom.name}</h1>
          <p className="sub">Khối {classroom.gradeLevel} · {classroom.schoolYear} · {classroom.subject || "Vật lý"}</p></div></div>
        {!editable && <p className="badge b-warn" role="status" style={{ alignSelf: "flex-start" }}>Lớp đã bị xóa. Tài khoản trường cần mở lại lớp trước khi phân công.</p>}
        {notice && <p className="badge b-success" role="status" style={{ alignSelf: "flex-start" }}>{notice}</p>}
        {(users.error || classes.error) && <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start" }}>{users.error || classes.error}</p>}

        <section className="card" aria-labelledby="class-teacher-heading">
          <div className="card-h"><div><h2 className="h2" id="class-teacher-heading">Giáo viên phụ trách</h2><p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>Mỗi lớp có một giáo viên phụ trách giao bài và chấm điểm.</p></div>
            {editable && classroom.teachers.length <= 1 && <button type="button" className={"btn btn-sm" + (classroom.teachers.length ? "" : " btn-primary")} disabled={users.loading} aria-haspopup="dialog" onClick={() => { setNotice(""); setAction({ kind: "teacher" }); }}>
              {icon(classroom.teachers.length ? "refresh" : "plus")}{classroom.teachers.length ? "Thay giáo viên" : "Phân công giáo viên"}</button>}</div>
          {classroom.teachers.length > 1 && <p className="badge b-warn" role="alert" style={{ margin: "12px 16px 0" }}>Lớp có nhiều giáo viên từ phân công cũ. Hãy gỡ bớt để chỉ giữ một người phụ trách.</p>}
          {classroom.teachers.length === 0 ? <p className="muted" style={{ padding: 20, margin: 0 }}>Lớp chưa có giáo viên phụ trách.</p>
            : <ul className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>{classroom.teachers.map(member => <li key={member.id} className="member-row">
              <Avatar member={member} size={40} /><span className="row-sub" style={{ flex: 1, minWidth: 0 }}><span className="clamp-1">{member.fullName}</span><small className="clamp-1">{member.email}</small></span>
              {editable && <button type="button" className="btn btn-sm btn-ghost" aria-haspopup="dialog" onClick={() => { setNotice(""); setAction({ kind: "remove-teacher", member }); }}>Gỡ</button>}</li>)}</ul>}
        </section>

        <section className="card" aria-labelledby="class-students-heading">
          <div className="card-h"><div><h2 className="h2" id="class-students-heading">Học sinh</h2><p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{classroom.students.length} học sinh đang học</p></div>
            {editable && <button type="button" className="btn btn-sm btn-primary" disabled={users.loading} aria-haspopup="dialog" onClick={() => { setNotice(""); setAction({ kind: "students" }); }}>{icon("plus")}Thêm học sinh</button>}</div>
          <div className="toolbar"><label className="search"><span className="sr">Tìm học sinh trong lớp</span>{icon("search")}<input className="input" type="search" placeholder="Tìm theo tên hoặc email…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label></div>
          {classroom.students.length === 0 ? <p className="muted" style={{ padding: 20, margin: 0 }}>Lớp chưa có học sinh. Bấm “Thêm học sinh” để xếp học sinh vào lớp.</p>
            : !students.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>Không có học sinh phù hợp.</p>
            : <div className="table-scroll"><table className="table">
              <thead><tr><th scope="col" className="num" style={{ width: 56 }}>STT</th><th scope="col">Họ và tên</th><th scope="col">Email</th>{editable && <th scope="col"><span className="sr">Thao tác</span></th>}</tr></thead>
              <tbody>{students.slice((current - 1) * size, current * size).map((member, index) => <tr key={member.id}>
                <td className="num muted">{(current - 1) * size + index + 1}</td>
                <th scope="row"><span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><Avatar member={member} /><span className="clamp-1" style={{ fontWeight: 500 }}>{member.fullName}</span></span></th>
                <td className="muted">{member.email || "—"}</td>
                {editable && <td className="num"><span style={{ display: "inline-flex", gap: 6 }}>
                  <button type="button" className="btn btn-sm" aria-haspopup="dialog" onClick={() => { setNotice(""); setAction({ kind: "transfer", student: member }); }}>Chuyển lớp</button>
                  <button type="button" className="btn btn-sm btn-ghost" aria-haspopup="dialog" onClick={() => { setNotice(""); setAction({ kind: "remove-student", member }); }}>Gỡ</button></span></td>}
              </tr>)}</tbody>
            </table></div>}
          {students.length > 0 && <div className="pager"><span>Hiển thị {(current - 1) * size + 1}–{Math.min(current * size, students.length)} / {students.length} học sinh</span>
            <span className="actions" style={{ gap: 8, alignItems: "center" }}><label className="pager-size">Số dòng <select className="input" style={{ width: 72 }} value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <button type="button" className="btn btn-sm" disabled={current === 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {current} / {pages}</span><button type="button" className="btn btn-sm" disabled={current === pages} onClick={() => setPage(current + 1)}>Sau</button></span></div>}
        </section>

        {action?.kind === "teacher" && <TeacherDialog portal={portal} schoolId={schoolId} classroom={classroom} users={users.data ?? []} onClose={() => setAction(null)} onDone={done} />}
        {action?.kind === "students" && <StudentsDialog portal={portal} schoolId={schoolId} classroom={classroom} users={users.data ?? []} onClose={() => setAction(null)} onDone={done} />}
        {action?.kind === "transfer" && <TransferDialog portal={portal} schoolId={schoolId} classroom={classroom} student={action.student} classes={classes.data ?? []} onClose={() => setAction(null)} onDone={done} />}
        {(action?.kind === "remove-teacher" || action?.kind === "remove-student") && <RemoveDialog portal={portal} schoolId={schoolId} classroom={classroom} member={action.member} teacher={action.kind === "remove-teacher"} onClose={() => setAction(null)} onDone={done} />}
      </>}
  </main>;
}

type DialogProps = { portal: HTMLElement; schoolId: string; classroom: SchoolClassDetail; onClose: () => void; onDone: (message: string) => void };

/** The canvas dialog frame: title, a scrolling body, and the actions along the bottom. */
function Frame({ portal, title, description, busy, error, width = 520, onClose, onSubmit, submit, danger, disabled, children }: Readonly<{
  portal: HTMLElement; title: string; description: string; busy: boolean; error: string; width?: number; onClose: () => void;
  onSubmit: () => void; submit: string; danger?: boolean; disabled?: boolean; children?: ReactNode }>) {
  const send = (event: FormEvent) => { event.preventDefault(); if (!busy && !disabled) onSubmit(); };
  return <Dialog.Root open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <Dialog.Portal container={portal}><Dialog.Overlay className="scrim is-fixed" />
      <Dialog.Content className="dialog is-fixed" style={{ width: `min(${width}px, calc(100% - 32px))` }}>
        <form onSubmit={send} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="card-h"><div style={{ minWidth: 0 }}><Dialog.Title className="h2">{title}</Dialog.Title><Dialog.Description className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>{description}</Dialog.Description></div>
            <Dialog.Close className="btn btn-sm btn-ghost" aria-label="Đóng" disabled={busy}>{icon("x")}</Dialog.Close></div>
          {(children || error) && <div className="card-b dialog-scroll">{children}{error && <p className="badge b-danger" role="alert" style={{ margin: 0, whiteSpace: "normal" }}>{error}</p>}</div>}
          <div className="card-h" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-end", gap: 8 }}>
            <Dialog.Close type="button" className="btn btn-ghost" disabled={busy}>Hủy</Dialog.Close>
            <button type="submit" className={"btn " + (danger ? "btn-danger" : "btn-primary")} disabled={busy || disabled}>{busy ? "Đang cập nhật…" : submit}</button></div>
        </form>
      </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

function useRun(onDone: (message: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (work: () => Promise<string>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { onDone(await work()); } catch (cause) { setError(apiMessage(cause, "Không thể cập nhật lớp học.")); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

function PickSearch({ value, onChange, label }: Readonly<{ value: string; onChange: (value: string) => void; label: string }>) {
  return <label className="search" style={{ width: "100%" }}><span className="sr">{label}</span>{icon("search")}<input className="input" type="search" autoFocus placeholder="Tìm theo tên hoặc email…" value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function TeacherDialog({ portal, schoolId, classroom, users, onClose, onDone }: Readonly<DialogProps & { users: User[] }>) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<number | null>(null);
  const { busy, error, run } = useRun(onDone);
  const present = classroom.teachers[0];
  // only accounts that hold the teaching permission can be put in charge of a class
  const teachers = useMemo(() => users.filter(user => canTeach(user) && user.active !== false && user.id !== present?.id) as (User & Member)[], [users, present?.id]);
  const visible = teachers.filter(member => matches(member, query));
  const picked = teachers.find(member => member.id === chosen);
  const submit = () => { if (picked) void run(async () => {
    if (present) { await replaceClassTeacher(schoolId, classroom.id, picked.id, present.id); return `Đã thay ${present.fullName} bằng ${picked.fullName}. Bài tập và điểm của lớp được giữ nguyên.`; }
    await assignClassTeacher(schoolId, classroom.id, picked.id); return `Đã phân công ${picked.fullName} phụ trách lớp ${classroom.name}.`;
  }); };
  return <Frame portal={portal} title={present ? "Thay giáo viên phụ trách" : "Phân công giáo viên"} width={560} busy={busy} error={error} onClose={onClose} onSubmit={submit} disabled={!picked}
    description={present ? `Đang phụ trách: ${present.fullName}. Bài tập và điểm cũ vẫn ở lại lớp.` : `Chọn giáo viên phụ trách lớp ${classroom.name}.`} submit={present ? "Thay giáo viên" : "Phân công"}>
    <PickSearch value={query} onChange={setQuery} label="Tìm giáo viên" />
    <div className="pick-list" role="radiogroup" aria-label="Giáo viên">{visible.length === 0 ? <p className="muted" style={{ padding: 16, margin: 0 }}>{teachers.length ? "Không có giáo viên phù hợp." : "Trường chưa có giáo viên nào khác có quyền giảng dạy."}</p>
      : visible.map(member => <label key={member.id} className="pick-row"><input type="radio" name="teacher" checked={chosen === member.id} onChange={() => setChosen(member.id)} />
        <Avatar member={member} /><span className="row-sub" style={{ minWidth: 0 }}><span className="clamp-1">{member.fullName}</span><small className="clamp-1">{member.email}</small></span></label>)}</div>
    <small className="muted">{visible.length}/{teachers.length} giáo viên có quyền giảng dạy</small>
  </Frame>;
}

function StudentsDialog({ portal, schoolId, classroom, users, onClose, onDone }: Readonly<DialogProps & { users: User[] }>) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const { busy, error, run } = useRun(onDone);
  const candidates = useMemo(() => users.filter(user => user.role === "STUDENT" && user.active !== false && !classroom.students.some(member => member.id === user.id)) as (User & Member)[], [users, classroom.students]);
  const visible = candidates.filter(member => matches(member, query)).slice(0, 200);
  const toggle = (id: number) => setChosen(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const submit = () => void run(async () => {
    const picked = candidates.filter(member => chosen.has(member.id));
    const failed: string[] = [];
    // one request per student, in order, so a refusal for one (already in another class this year…) does not stop the rest
    for (const member of picked) {
      try { await enrollClassStudent(schoolId, classroom.id, member.id); } catch (cause) { failed.push(`${member.fullName}: ${apiMessage(cause, "không thêm được")}`); }
    }
    if (failed.length === picked.length) throw new Error(failed.join("\n"));
    return failed.length ? `Đã thêm ${picked.length - failed.length}/${picked.length} học sinh. Chưa thêm được — ${failed.join("; ")}` : `Đã thêm ${picked.length} học sinh vào lớp ${classroom.name}.`;
  });
  return <Frame portal={portal} title="Thêm học sinh vào lớp" width={600} busy={busy} error={error} onClose={onClose} onSubmit={submit} disabled={!chosen.size}
    description={`Chọn học sinh của trường để xếp vào lớp ${classroom.name}.`} submit={chosen.size ? `Thêm ${chosen.size} học sinh` : "Thêm học sinh"}>
    <PickSearch value={query} onChange={setQuery} label="Tìm học sinh" />
    <div className="pick-list" aria-label="Học sinh">{visible.length === 0 ? <p className="muted" style={{ padding: 16, margin: 0 }}>{candidates.length ? "Không có học sinh phù hợp." : "Mọi học sinh của trường đã ở trong lớp này."}</p>
      : visible.map(member => <label key={member.id} className="pick-row"><input type="checkbox" checked={chosen.has(member.id)} onChange={() => toggle(member.id)} />
        <Avatar member={member} /><span className="row-sub" style={{ minWidth: 0 }}><span className="clamp-1">{member.fullName}</span><small className="clamp-1">{member.email}</small></span></label>)}</div>
    <small className="muted">Đã chọn {chosen.size} · {visible.length < candidates.filter(member => matches(member, query)).length ? `hiện 200 đầu tiên, gõ để tìm thêm · ` : ""}{candidates.length} học sinh chưa ở lớp này</small>
  </Frame>;
}

function TransferDialog({ portal, schoolId, classroom, student, classes, onClose, onDone }: Readonly<DialogProps & { student: Member; classes: SchoolClassSummary[] }>) {
  const targets = classes.filter(item => item.id !== classroom.id && item.active !== false && item.schoolYear === classroom.schoolYear);
  const [target, setTarget] = useState("");
  const { busy, error, run } = useRun(onDone);
  const picked = targets.find(item => item.id === target);
  return <Frame portal={portal} title="Chuyển lớp" busy={busy} error={error} onClose={onClose} disabled={!picked} submit="Chuyển lớp"
    description={`${student.fullName} · đang học ${classroom.name}`}
    onSubmit={() => { if (picked) void run(async () => { await transferClassStudent(schoolId, picked.id, student.id); return `Đã chuyển ${student.fullName} sang lớp ${picked.name}. Điểm và bài nộp ở lớp cũ được giữ nguyên.`; }); }}>
    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 500 }}>Lớp mới (cùng năm học {classroom.schoolYear})
      <select className="input" value={target} autoFocus onChange={event => setTarget(event.target.value)}><option value="">Chọn lớp…</option>{targets.map(item => <option key={item.id} value={item.id}>{item.name} · Khối {item.gradeLevel}</option>)}</select></label>
    {!targets.length && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Không có lớp nào khác đang hoạt động trong năm học này.</p>}
    <p className="muted" style={{ margin: 0, fontSize: 13 }}>Học sinh vẫn hoàn thành các bài cũ và nhận thêm những bài còn mở của lớp mới.</p>
  </Frame>;
}

function RemoveDialog({ portal, schoolId, classroom, member, teacher, onClose, onDone }: Readonly<DialogProps & { member: Member; teacher: boolean }>) {
  const { busy, error, run } = useRun(onDone);
  return <Frame portal={portal} title={teacher ? "Gỡ giáo viên khỏi lớp?" : "Gỡ học sinh khỏi lớp?"} busy={busy} error={error} onClose={onClose} danger submit="Gỡ khỏi lớp"
    description={teacher ? `${member.fullName} sẽ không còn phụ trách lớp ${classroom.name}. Lớp chưa có giáo viên cho đến khi bạn phân công người khác.`
      : `${member.fullName} sẽ không nhận bài mới của lớp ${classroom.name}. Bài nộp và điểm cũ vẫn được giữ.`}
    onSubmit={() => void run(async () => {
      if (teacher) { await removeClassTeacher(schoolId, classroom.id, member.id); return `Đã gỡ ${member.fullName} khỏi lớp.`; }
      await removeClassStudent(schoolId, classroom.id, member.id); return `Đã gỡ ${member.fullName} khỏi lớp.`;
    })} />;
}
