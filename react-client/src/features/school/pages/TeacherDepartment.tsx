import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Dialog } from "radix-ui";
import api from "../../../shared/api/client";
import type { DataPage } from "../../../shared/api/page";
import { departmentBase } from "../../../shared/auth/permissions";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { useResource } from "../../../shared/hooks/operationsData";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import { apiMessage } from "../../../shared/lib/apiError";
import PageActions from "../../../shared/layout/PageActions";
import type { LibraryItem } from "../../../shared/types/physlive";
import StudioTableSkeleton from "../../assignments/components/StudioTableSkeleton";
import { useStudioPortal } from "../../assignments/components/useStudioPortal";
import { ModerationPreview } from "../../library/components/ModerationPreview";
import { timeAgo } from "../../reviewer/model/reviewerUtils";
import type { SchoolClassSummary } from "../types";
import SchoolAssignmentDialog from "../components/SchoolAssignmentDialog";

type Assignment = { id: string; title: string; classId: string | null; className: string | null; schoolYear: string | null; teacherId: number; teacherName: string; studentCount: number; status: string; assignedAt: string; dueAt: string | null };
type AssignmentPage = { content: Assignment[]; totalElements: number; totalPages: number; number: number };
type ModeratedItem = Omit<LibraryItem, "moderationStatus"> & { moderationStatus?: string; moderationComment?: string | null };
type Tab = "classes" | "assignments" | "library";

const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const due = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Không giới hạn";
const initials = (name?: string | null) => (name || "GV").trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();
const MODERATION: Record<string, string> = { PENDING: "Chờ duyệt", APPROVED: "Đã duyệt", REJECTED: "Bị từ chối", REMOVED: "Đã gỡ" };
const moderationTone = (status = "PENDING") => ["APPROVED", "FEATURED"].includes(status) ? "b-success" : status === "PENDING" ? "b-warn" : "";
/** The overview reads the most recent assignments in one request (the server allows up to 100 a page). */
const OVERVIEW = 100;
const PAGE = 30;

/** Department head workspace — the canvas artboard "Quản lý chuyên môn". */
export default function TeacherDepartment() {
  const user = useSessionStore(state => state.user);
  const schoolId = user?.schoolId ?? "";
  const [params, setParams] = useSearchParams();
  const tab: Tab = (["classes", "assignments", "library"] as const).find(value => value === params.get("tab")) ?? "assignments";
  const [host, setHost] = useState<HTMLElement | null>(null);
  const portal = useStudioPortal(host);
  const overview = useResource<AssignmentPage>(`/schools/${schoolId}/assignments?page=0&size=${OVERVIEW}`, Boolean(schoolId));
  const pending = useResource<ModeratedItem[]>(`/schools/${schoolId}/library?status=PENDING`, Boolean(schoolId));
  const recent = overview.data?.content ?? [];
  const total = overview.data?.totalElements ?? 0;
  const active = recent.filter(item => item.status === "ACTIVE");
  const teachers = [...recent.reduce((map, item) => map.set(item.teacherName, (map.get(item.teacherName) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const busiest = Math.max(1, ...teachers.map(([, count]) => count));
  const partial = total > recent.length;
  const dash = (value: string | number) => overview.loading ? "—" : value;
  const go = (value: Tab) => { const next = new URLSearchParams(params); next.set("tab", value); setParams(next, { replace: true }); };
  const refresh = () => { void overview.refresh(); void pending.refresh(); };
  if (!schoolId) return null;

  return <main className="page" ref={setHost}>
    <div className="ph ph-spot" style={{ "--spot": "url(/studio/il-school.svg)" } as React.CSSProperties}><div>
      <span className="badge b-brand plain" style={{ marginBottom: 8 }}>Tổ trưởng bộ môn</span><h1 className="h1">Quản lý chuyên môn</h1><p className="sub">Tổ Vật lý · {user?.schoolName || "Trường của bạn"}</p></div></div>
    <section className="stats" aria-label="Chỉ số">
      <div className="stat"><i className="stat-ic" data-k="Bài đang giao" aria-hidden="true"></i><span className="stat-l">Bài đang giao</span><span className="stat-v">{dash(active.length)}</span><span className="stat-h">Trong {total.toLocaleString("vi-VN")} bài của trường{partial ? ` · ${OVERVIEW} bài gần nhất` : ""}</span></div>
      <div className="stat"><i className="stat-ic" data-k="Giáo viên trong tổ" aria-hidden="true"></i><span className="stat-l">Giáo viên giao bài</span><span className="stat-v">{dash(teachers.length)}</span><span className="stat-h">Có bài trong trường</span></div>
      <div className="stat"><i className="stat-ic" data-k="Lớp có bài" aria-hidden="true"></i><span className="stat-l">Lớp có bài</span><span className="stat-v">{dash(new Set(active.map(item => item.classId).filter(Boolean)).size)}</span><span className="stat-h">{active.reduce((sum, item) => sum + item.studentCount, 0).toLocaleString("vi-VN")} học sinh đang được giao</span></div>
      <div className="stat"><i className="stat-ic" data-k="Đang xử lý" aria-hidden="true"></i><span className="stat-l">Chờ duyệt nội bộ</span><span className="stat-v">{pending.loading ? "—" : pending.data?.length ?? 0}</span><span className="stat-h">Mô phỏng chia sẻ trong trường</span></div>
    </section>
    <div className="split"><div className="col" style={{ flex: "2.4 1 560px", gap: 16 }}>
      <div className="tabs" role="tablist" aria-label="Quản lý chuyên môn">{([["classes", "Lớp & phân công"], ["assignments", "Bài tập trong trường"], ["library", "Duyệt nội dung nội bộ"]] as const).map(([value, label]) =>
        <button key={value} role="tab" type="button" aria-selected={tab === value} onClick={() => go(value)}>{label}{value === "library" && (pending.data?.length ?? 0) > 0 && <span className="count">{pending.data!.length}</span>}</button>)}</div>
      {tab === "assignments" && <Assignments schoolId={schoolId} portal={portal} onRefresh={refresh} />}
      {tab === "classes" && <Classes schoolId={schoolId} />}
      {tab === "library" && <Moderation schoolId={schoolId} portal={portal} onChanged={() => void pending.refresh()} />}
    </div><aside className="col insight-col" style={{ flex: "1 1 280px", gap: 16 }}>
      <section className="card"><div className="card-h"><h2 className="h2">Bài giao theo giáo viên</h2><span className="muted" style={{ fontSize: 12 }}>{partial ? `${OVERVIEW} bài gần nhất` : "Tất cả bài"}</span></div>
        <div className="card-b form" style={{ gap: 14 }}>{overview.loading ? <span className="muted">Đang tải…</span> : teachers.length ? teachers.slice(0, 6).map(([name, count], index) => <div className="hrow" key={name}>
          <span><span className="clamp-1" title={name}>{name}</span><b>{count}</b></span><span className="bar"><i style={{ width: Math.round(count / busiest * 100) + "%", animationDelay: index * 70 + "ms" }}></i></span></div>)
          : <span className="muted">Chưa có bài tập nào trong trường.</span>}</div></section>
      <section className="card"><div className="card-h"><h2 className="h2">Duyệt nội dung nội bộ</h2><span className="muted" style={{ fontSize: 12 }}>{pending.loading ? "…" : (pending.data?.length ?? 0) + " mô phỏng"}</span></div>
        <div className="card-b form" style={{ gap: 14 }}>{pending.loading ? <span className="muted">Đang tải…</span> : pending.data?.length ? <>
          <ul className="mini-list">{pending.data.slice(0, 3).map(item => <li key={item.id}><span className="tile" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(item.sharedByName)}</span>
            <span className="row-t"><b className="clamp-1" title={item.title}>{item.title}</b><small>{item.sharedByName || "Giáo viên"} · gửi {timeAgo(item.createdAt)}</small></span><span className="badge b-warn">Chờ duyệt</span></li>)}</ul>
          {tab !== "library" && <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => go("library")}>Mở danh sách duyệt</button>}</>
          : <span className="muted">Không có mô phỏng nào chờ duyệt.</span>}</div></section>
    </aside></div>
  </main>;
}

function Pager({ text, page, pages, onPage }: Readonly<{ text: string; page: number; pages: number; onPage: (page: number) => void }>) {
  return <div className="pager"><span aria-live="polite">{text}</span><span className="actions" style={{ gap: 8, alignItems: "center" }}>
    <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Trước</button><span>Trang {page} / {pages}</span>
    <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Sau</button></span></div>;
}

function Assignments({ schoolId, portal, onRefresh }: Readonly<{ schoolId: string; portal: HTMLElement; onRefresh: () => void }>) {
  const [opened, setOpened] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [teacher, setTeacher] = useState("ALL");
  const resource = useResource<AssignmentPage>(`/schools/${schoolId}/assignments?page=${page - 1}&size=${PAGE}`);
  const items = resource.data?.content ?? [];
  const teachers = [...new Map(items.map(item => [item.teacherId, item.teacherName])).entries()];
  const rows = items.filter(item => (teacher === "ALL" || String(item.teacherId) === teacher)
    && `${item.title} ${item.teacherName} ${item.className ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const pages = Math.max(1, resource.data?.totalPages ?? 1);
  // the search and teacher list only cover the page on screen, as the server pages the school's assignments
  const turn = (next: number) => { setTeacher("ALL"); setPage(next); };
  return <section className="card" aria-label="Phân công bài tập">
    <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={resource.refreshing} onClick={() => { void resource.refresh(); onRefresh(); }}>{icon("refresh")}Làm mới</button></PageActions>
    <div className="toolbar"><label className="search"><span className="sr">Tìm bài tập trong trang</span>{icon("search")}<input className="input" type="search" placeholder="Tìm bài tập, lớp hoặc giáo viên trong trang" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <select className="input" style={{ width: 220 }} aria-label="Giáo viên trong trang" value={teacher} onChange={event => setTeacher(event.target.value)}><option value="ALL">Tất cả giáo viên trong trang</option>{teachers.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}</select></div>
    {resource.error && <p className="badge b-danger" role="alert" style={{ margin: "12px 16px 0" }}>{resource.error}</p>}
    {resource.loading ? <StudioTableSkeleton headers={["Bài tập", "Hạn nộp", "Trạng thái"]} label="Đang tải bài tập…" />
      : !rows.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>{items.length ? "Không có bài tập phù hợp trong trang này." : "Trường chưa có bài tập nào."}</p>
      : <div className="table-scroll"><table className="table">
        <thead><tr><th scope="col">Bài tập</th><th scope="col">Hạn nộp</th><th scope="col">Trạng thái</th></tr></thead>
        <tbody>{rows.map(item => <tr key={item.id} className="row-clickable" onClick={event => { if (!(event.target as HTMLElement).closest("button, a")) setOpened(item.id); }}>
          <th scope="row" style={{ whiteSpace: "normal", minWidth: 260 }}><span className="row-sub"><button type="button" className="row-link clamp-2" title={item.title} aria-haspopup="dialog" onClick={() => setOpened(item.id)}>{item.title}</button><small>{item.teacherName} · {item.className ? item.className + (item.schoolYear ? " (" + item.schoolYear + ")" : "") : "Giao trực tiếp"} · {item.studentCount} học sinh</small></span></th>
          <td className="muted" style={{ whiteSpace: "nowrap" }}>{due(item.dueAt)}</td>
          <td><span className={"badge " + (item.status === "ACTIVE" ? "b-success" : "")}>{item.status === "ACTIVE" ? "Đang giao" : "Đã đóng"}</span></td>
        </tr>)}</tbody>
      </table></div>}
    <Pager text={`${(resource.data?.totalElements ?? 0).toLocaleString("vi-VN")} bài tập trong trường`} page={Math.min(page, pages)} pages={pages} onPage={turn} />
    {opened && <SchoolAssignmentDialog schoolId={schoolId} assignmentId={opened} portal={portal} onClose={() => setOpened(null)} />}
  </section>;
}

/**
 * Classes of the school, read-only for the department head: renaming, deleting and reopening a class belong to the
 * school account (the server refuses them too); the head places teachers and students, not the classes themselves.
 */
function Classes({ schoolId }: Readonly<{ schoolId: string }>) {
  const user = useSessionStore(state => state.user);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(query);
  const params = new URLSearchParams({ page: String(page - 1), size: "10", query: search, year, status });
  if (grade !== "ALL") params.set("grade", grade);
  const resource = useResource<DataPage<SchoolClassSummary> & { years: string[] }>(`/schools/${schoolId}/classes/page?${params}`);
  const items = resource.data?.items ?? [];
  const totalItems = resource.data?.totalElements ?? 0;
  const pages = Math.max(1, resource.data?.totalPages ?? 1);
  return <section className="card" aria-label="Lớp học trong trường">
    <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={resource.refreshing} onClick={() => void resource.refresh()}>{icon("refresh")}Làm mới</button></PageActions>
    <div className="toolbar">
      <label className="search"><span className="sr">Tìm lớp học</span>{icon("search")}<input className="input" type="search" placeholder="Tìm theo tên lớp hoặc môn học…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
      <select className="input" style={{ width: 130 }} aria-label="Lọc theo khối" value={grade} onChange={event => { setGrade(event.target.value); setPage(1); }}><option value="ALL">Tất cả khối</option>{[10, 11, 12].map(value => <option key={value} value={value}>Khối {value}</option>)}</select>
      <select className="input" style={{ width: 150 }} aria-label="Lọc theo năm học" value={year} onChange={event => { setYear(event.target.value); setPage(1); }}><option value="ALL">Tất cả năm học</option>{(resource.data?.years ?? []).map(value => <option key={value} value={value}>{value}</option>)}</select>
      <select className="input" style={{ width: 160 }} aria-label="Lọc theo trạng thái lớp" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Đã xóa</option><option value="ALL">Tất cả trạng thái</option></select>
    </div>
    <p className="muted" style={{ margin: 0, padding: "10px 16px", fontSize: 13, borderBottom: "1px solid var(--border)" }}>{icon("lock")} Bạn phân công giáo viên và xếp học sinh vào lớp. Tạo, sửa, xóa hoặc mở lại lớp do tài khoản trường thực hiện.</p>
    {resource.error && <p className="badge b-danger" role="alert" style={{ margin: "12px 16px 0" }}>{resource.error}</p>}
    {resource.loading ? <StudioTableSkeleton headers={["Lớp", "Giáo viên", "Học sinh", "Trạng thái", ""]} label="Đang tải lớp học…" />
      : !items.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>Không tìm thấy lớp phù hợp với bộ lọc.</p>
      : <div className="table-scroll"><table className="table">
        <thead><tr><th scope="col">Lớp</th><th scope="col">Giáo viên</th><th scope="col" className="num">Học sinh</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr">Thao tác</span></th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id}>
          <th scope="row"><span style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="tile" style={{ width: 28, height: 28, fontSize: 12 }}>{item.gradeLevel}</span>
            <span className="row-sub"><span>{item.name}</span><small>Khối {item.gradeLevel} · {item.schoolYear} · {item.subject || "—"}</small></span></span></th>
          <td className="muted" style={{ whiteSpace: "normal", minWidth: 160 }}>{item.teacherNames?.filter(Boolean).join(", ") || "Chưa phân công"}</td>
          <td className="num">{item.studentCount}</td>
          <td><span className={"badge " + (item.active ? "b-success" : "")}>{item.active ? "Hoạt động" : "Đã xóa"}</span></td>
          <td className="num"><Link className="btn btn-sm" to={`${departmentBase(user)}/classes/${item.id}`}>{item.active ? "Phân công" : "Xem"}</Link></td>
        </tr>)}</tbody>
      </table></div>}
    {totalItems > 0 && <Pager text={`${totalItems.toLocaleString("vi-VN")} lớp`} page={Math.min(page, pages)} pages={pages} onPage={setPage} />}
  </section>;
}

function Moderation({ schoolId, portal, onChanged }: Readonly<{ schoolId: string; portal: HTMLElement; onChanged: () => void }>) {
  const topicName = useTopicName();
  const user = useSessionStore(state => state.user);
  const [filter, setFilter] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<ModeratedItem | null>(null);
  const [decision, setDecision] = useState<{ item: ModeratedItem; status: "REJECTED" | "REMOVED" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const endpoint = `/schools/${schoolId}/library`;
  const resource = useResource<ModeratedItem[]>(`${endpoint}?status=${filter}`);
  const rows = (resource.data ?? []).filter(item => (item.moderationStatus || "PENDING") === filter
    && `${item.title} ${topicName(item.topic)} ${item.sharedByName ?? ""}`.toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const decide = async (item: ModeratedItem, status: "APPROVED" | "REJECTED" | "REMOVED", comment?: string) => {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.put(`${endpoint}/${item.id}`, { status, comment: comment?.trim() });
      setNotice((status === "APPROVED" ? "Đã duyệt: " : status === "REJECTED" ? "Đã từ chối: " : "Đã gỡ: ") + item.title);
      void resource.refresh(); onChanged();
      return true;
    } catch (cause) { setError(apiMessage(cause, "Không thể cập nhật nội dung chia sẻ.")); return false; }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (decision && reason.trim() && await decide(decision.item, decision.status, reason)) setDecision(null);
  };
  return <section className="card" aria-label="Nội dung nội bộ cần duyệt">
    <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={resource.refreshing} onClick={() => { void resource.refresh(); onChanged(); }}>{icon("refresh")}Làm mới</button></PageActions>
    <div className="toolbar"><label className="search"><span className="sr">Tìm nội dung chia sẻ</span>{icon("search")}<input className="input" type="search" placeholder="Tìm tiêu đề, chủ đề hoặc người chia sẻ" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="seg" role="group" aria-label="Lọc trạng thái nội dung">{["PENDING", "APPROVED", "REJECTED", "REMOVED"].map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{MODERATION[value]}</button>)}</div></div>
    {notice && <p className="badge b-success" role="status" style={{ margin: "12px 16px 0" }}>{notice}</p>}
    {(error && !decision || resource.error) && <p className="badge b-danger" role="alert" style={{ margin: "12px 16px 0" }}>{error || resource.error}</p>}
    {resource.loading ? <StudioTableSkeleton headers={["Nội dung", "Người chia sẻ", "Trạng thái", ""]} label="Đang tải nội dung…" />
      : !rows.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>{query ? "Không có nội dung phù hợp." : filter === "PENDING" ? "Không có mô phỏng nào chờ duyệt." : "Chưa có nội dung ở trạng thái này."}</p>
      : <div className="table-scroll"><table className="table">
        <thead><tr><th scope="col">Nội dung</th><th scope="col">Người chia sẻ</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr">Thao tác</span></th></tr></thead>
        <tbody>{rows.map(item => {
          const own = item.sharedById === user?.id;
          return <tr key={item.id}>
            <th scope="row" style={{ whiteSpace: "normal", minWidth: 220 }}><span className="row-sub"><span className="clamp-2" title={item.title}>{item.title}</span><small>{topicName(item.topic) || "—"}{item.moderationComment ? " · " + item.moderationComment : ""}</small></span></th>
            <td className="muted">{item.sharedByName || "—"}</td>
            <td><span className={"badge " + moderationTone(item.moderationStatus)}>{MODERATION[item.moderationStatus || "PENDING"] ?? item.moderationStatus}</span></td>
            <td className="num"><span className="actions" style={{ gap: 6, justifyContent: "flex-end", flexWrap: "nowrap" }}>
              <button type="button" className="btn btn-sm btn-ghost" aria-haspopup="dialog" onClick={() => setPreview(item)}>Xem</button>
              {item.moderationStatus !== "APPROVED" && <button type="button" className="btn btn-sm" disabled={busy || own} title={own ? "Không tự duyệt nội dung của mình" : undefined} onClick={() => void decide(item, "APPROVED")}>Duyệt</button>}
              {item.moderationStatus !== "REJECTED" && item.moderationStatus !== "REMOVED" && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} aria-haspopup="dialog" onClick={() => { setError(""); setReason(""); setDecision({ item, status: item.moderationStatus === "APPROVED" ? "REMOVED" : "REJECTED" }); }}>{item.moderationStatus === "APPROVED" ? "Gỡ" : "Từ chối"}</button>}
            </span></td>
          </tr>;
        })}</tbody>
      </table></div>}
    {preview && <ModerationPreview item={preview} onClose={() => setPreview(null)} />}
    <Dialog.Root open={Boolean(decision)} onOpenChange={value => { if (!value && !busy) setDecision(null); }}>
      <Dialog.Portal container={portal}><Dialog.Overlay className="scrim is-fixed" />
        <Dialog.Content className="dialog is-fixed" style={{ width: "min(520px, calc(100% - 32px))" }}>
          <form onSubmit={event => void submit(event)} style={{ display: "contents" }}>
            <div className="card-h"><div><Dialog.Title className="h2">{decision?.status === "REJECTED" ? "Từ chối nội dung" : "Gỡ nội dung khỏi thư viện trường"}</Dialog.Title><Dialog.Description className="muted" style={{ fontSize: 13, marginTop: 2 }}>{decision?.item.title}</Dialog.Description></div></div>
            <div className="card-b dialog-scroll"><label className="form" style={{ gap: 6 }}><span style={{ fontSize: 13, fontWeight: 500 }}>Lý do (người chia sẻ sẽ thấy)</span>
              <textarea className="input" rows={3} required maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} style={{ height: "auto", padding: "8px 10px", resize: "vertical" }} /></label>
              {error && <p className="badge b-danger" role="alert" style={{ margin: 0 }}>{error}</p>}</div>
            <div className="card-h" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-end", gap: 8 }}>
              <Dialog.Close type="button" className="btn btn-ghost" disabled={busy}>Hủy</Dialog.Close>
              <button type="submit" className="btn btn-danger" disabled={busy || !reason.trim()}>{busy ? "Đang cập nhật…" : decision?.status === "REJECTED" ? "Từ chối" : "Gỡ nội dung"}</button></div>
          </form>
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </section>;
}
