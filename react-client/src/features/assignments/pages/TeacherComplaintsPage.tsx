import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "radix-ui";
import { useResource } from "../../../shared/hooks/operationsData";
import { isWithinSentDates } from "../../../shared/lib/sentDateRange";
import PageActions from "../../../shared/layout/PageActions";
import type { SimulationComplaint } from "../../support/api/supportApi";
import { COMPLAINT_STATUS } from "../../support/model/complaintStatus";
import StudioTableSkeleton from "../components/StudioTableSkeleton";
import { useStudioPortal } from "../components/useStudioPortal";

const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const code = (id: string) => "KN-" + id.slice(0, 8).toUpperCase();
const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const tone = (status: string) => status === "RESOLVED" ? "b-success" : status === "READ" ? "b-info" : "b-warn";
const DAY = 86_400_000;
/** The report form appends the problem statement after this marker; the list shows only what the teacher wrote. */
function contents(value: string) {
  const marker = "\n— Đề bài —";
  const index = value.indexOf(marker);
  return index < 0 ? { detail: value, context: "" } : { detail: value.slice(0, index), context: value.slice(index + marker.length) };
}

/** Teacher complaints — the canvas artboard "Khiếu nại đã gửi", on the teacher's own complaints. */
export default function TeacherComplaintsPage() {
  const resource = useResource<SimulationComplaint[]>("/support/mine");
  const items = useMemo(() => (resource.data ?? []).filter(item => item.kind === "COMPLAINT").sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)), [resource.data]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selectedId, setSelectedId] = useState("");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const portal = useStudioPortal(host);
  const opener = useRef<HTMLButtonElement | null>(null);
  const invalidDates = Boolean(from && to && from > to);
  const selected = items.find(item => item.id === selectedId);
  const selectedContent = selected ? contents(selected.content) : null;
  const filtered = invalidDates ? [] : items.filter(item => (status === "ALL" || item.status === status)
    && (code(item.id) + " " + item.subject).toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"))
    && isWithinSentDates(item.createdAt, from, to));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages);
  const start = (current - 1) * size;
  const hasFilters = Boolean(query || status !== "ALL" || from || to);
  const count = (value: string) => items.filter(item => item.status === value).length;
  const answered = items.filter(item => item.respondedAt);
  const averageDays = answered.length ? answered.reduce((sum, item) => sum + Math.max(0, Date.parse(item.respondedAt!) - Date.parse(item.createdAt)), 0) / answered.length / DAY : null;
  const busiest = Math.max(1, ...Object.keys(COMPLAINT_STATUS).map(count));
  const dash = (value: string | number) => resource.loading ? "—" : value;
  const open = (event: React.MouseEvent<HTMLButtonElement>, id: string) => { opener.current = event.currentTarget; setSelectedId(id); };

  return <main className="page" ref={setHost}>
    <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={resource.refreshing} onClick={() => void resource.refresh()}>{icon("refresh")}Làm mới</button></PageActions>
    <div className="ph ph-spot" style={{ "--spot": "url(/studio/il-complaint.svg)" } as React.CSSProperties}>
      <div><h1 className="h1">Khiếu nại đã gửi</h1><p className="sub">Theo dõi báo lỗi mô phỏng và phản hồi từ người kiểm duyệt.</p></div>
    </div>
    <section className="stats" aria-label="Chỉ số">
      <div className="stat"><i className="stat-ic" data-k="Đã gửi" aria-hidden="true"></i><span className="stat-l">Đã gửi</span><span className="stat-v">{dash(items.length)}</span><span className="stat-h">Tất cả khiếu nại của bạn</span></div>
      <div className="stat"><i className="stat-ic" data-k="Đang xử lý" aria-hidden="true"></i><span className="stat-l">Đang xử lý</span><span className="stat-v">{dash(count("OPEN") + count("READ"))}</span><span className="stat-h">{count("READ")} đang được xem xét</span></div>
      <div className="stat"><i className="stat-ic" data-k="Đã phản hồi" aria-hidden="true"></i><span className="stat-l">Đã phản hồi</span><span className="stat-v">{dash(answered.length)}</span><span className="stat-h">{count("RESOLVED")} đã giải quyết</span></div>
      <div className="stat"><i className="stat-ic" data-k="Phản hồi trung bình" aria-hidden="true"></i><span className="stat-l">Phản hồi trung bình</span><span className="stat-v">{dash(averageDays == null ? "—" : averageDays.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " ngày")}</span><span className="stat-h">Từ lúc gửi đến khi có phản hồi</span></div>
    </section>
    {resource.error && <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start" }}>{resource.error}</p>}
    <div className="split"><div className="col" style={{ flex: "2.4 1 560px", gap: 16 }}>
      <section className="card" aria-label="Danh sách khiếu nại">
        <div className="toolbar" role="group" aria-label="Bộ lọc khiếu nại">
          <label className="search"><span className="sr">Tìm kiếm</span>{icon("search")}<input className="input" type="search" placeholder="Tìm mã hoặc tiêu đề…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
          <select className="input" style={{ width: 170 }} aria-label="Trạng thái khiếu nại" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
            <option value="ALL">Tất cả trạng thái</option>{Object.entries(COMPLAINT_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <span className="date-range"><input className="input" type="date" aria-label="Khiếu nại từ ngày" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(1); }} /><span className="muted">–</span>
            <input className="input" type="date" aria-label="Khiếu nại đến ngày" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} /></span>
          {hasFilters && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setQuery(""); setStatus("ALL"); setFrom(""); setTo(""); setPage(1); }}>{icon("x")}Xóa bộ lọc</button>}
        </div>
        {invalidDates && <p className="badge b-danger" role="alert" style={{ margin: "12px 16px 0", alignSelf: "flex-start" }}>Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
        {resource.loading ? <StudioTableSkeleton headers={["Khiếu nại", "Nội dung", "Trạng thái", "Ngày gửi", ""]} label="Đang tải khiếu nại…" />
          : !filtered.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>{items.length === 0 && !hasFilters ? <>Bạn chưa gửi khiếu nại nào. <Link className="link" to="/workspace">Mở mô phỏng để báo lỗi</Link>.</> : "Không có khiếu nại phù hợp bộ lọc."}</p>
          : <div className="table-scroll"><table className="table">
            <thead><tr><th scope="col">Khiếu nại</th><th scope="col">Nội dung</th><th scope="col">Trạng thái</th><th scope="col">Ngày gửi</th><th scope="col"><span className="sr">Thao tác</span></th></tr></thead>
            <tbody>{filtered.slice(start, start + size).map(item => <tr key={item.id}>
              <th scope="row" style={{ minWidth: 170, whiteSpace: "normal" }}><span className="row-sub"><span className="clamp-2" title={item.subject}>{item.subject}</span><small className="mono">{code(item.id)}</small></span></th>
              <td className="muted" style={{ minWidth: 160, whiteSpace: "normal", textWrap: "pretty", lineHeight: 1.45 }}><span className="clamp-2">{contents(item.content).detail.trim()}</span></td>
              <td><span className={"badge " + tone(item.status)}>{COMPLAINT_STATUS[item.status]}</span></td>
              <td className="muted" style={{ whiteSpace: "nowrap" }}><time dateTime={item.createdAt}>{date(item.createdAt)}</time></td>
              <td className="num"><button type="button" className="btn btn-sm" aria-haspopup="dialog" onClick={event => open(event, item.id)}>Xem chi tiết</button></td>
            </tr>)}</tbody>
          </table></div>}
        <div className="pager"><span aria-live="polite">Hiển thị {filtered.length ? start + 1 : 0}–{Math.min(start + size, filtered.length)} / {filtered.length} khiếu nại</span>
          <span className="actions" style={{ gap: 8, alignItems: "center" }}><label className="pager-size">Số dòng <select className="input" style={{ width: 72 }} aria-label="Số khiếu nại mỗi trang" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <button type="button" className="btn btn-sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {current} / {pages}</span><button type="button" className="btn btn-sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Sau</button></span></div>
      </section>
    </div><aside className="col insight-col" style={{ flex: "1 1 280px", gap: 16 }}>
      <section className="card"><div className="card-h"><h2 className="h2">Theo trạng thái</h2><span className="muted" style={{ fontSize: 12 }}>{dash(items.length)} khiếu nại</span></div>
        <div className="card-b form" style={{ gap: 14 }}>{Object.entries(COMPLAINT_STATUS).map(([value, label], index) => <div className="hrow" key={value}>
          <span><span>{label}</span><b>{dash(count(value))}</b></span><span className="bar"><i style={{ width: Math.round(count(value) / busiest * 100) + "%", animationDelay: index * 70 + "ms" }}></i></span></div>)}</div></section>
      <section className="card"><div className="card-h"><h2 className="h2">Phản hồi gần đây</h2></div>
        <div className="card-b form" style={{ gap: 12 }}>{resource.loading ? <span className="muted">Đang tải…</span> : answered.length ? <ul className="mini-list">{[...answered].sort((a, b) => b.respondedAt!.localeCompare(a.respondedAt!)).slice(0, 3).map(item => <li key={item.id}>
          <span className="row-t"><b className="clamp-1" title={item.subject}>{item.subject}</b><small>{item.responderName || "Người kiểm duyệt"} · {date(item.respondedAt!)}</small></span>
          <button type="button" className="btn btn-sm btn-ghost" aria-haspopup="dialog" onClick={event => open(event, item.id)}>Xem</button></li>)}</ul>
          : <span className="muted">Chưa có phản hồi nào.</span>}</div></section>
    </aside></div>

    <Dialog.Root open={Boolean(selected)} onOpenChange={value => { if (!value) setSelectedId(""); }}>
      <Dialog.Portal container={portal}>
        <Dialog.Overlay className="scrim is-fixed" />
        <Dialog.Content className="dialog is-fixed" style={{ width: "min(640px, calc(100% - 32px))" }} onCloseAutoFocus={event => { if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus({ preventScroll: true }); } }}>
          <div className="card-h" style={{ alignItems: "flex-start" }}><div><Dialog.Title className="h2">Chi tiết khiếu nại</Dialog.Title><Dialog.Description className="muted mono" style={{ fontSize: 12, marginTop: 2 }}>{selected ? code(selected.id) : ""}</Dialog.Description></div>
            <Dialog.Close className="btn btn-sm btn-ghost" aria-label="Đóng chi tiết khiếu nại">{icon("x")}</Dialog.Close></div>
          {selected && selectedContent && <div className="card-b dialog-scroll">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}><b style={{ fontSize: 16, fontWeight: 600 }}>{selected.subject}</b>
              <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span className={"badge " + tone(selected.status)}>{COMPLAINT_STATUS[selected.status]}</span><span className="muted" style={{ fontSize: 13 }}>Gửi lúc {date(selected.createdAt)}</span></span></div>
            <section><h3 className="dialog-sub">Nội dung khiếu nại</h3><p className="prose">{selectedContent.detail.trim()}</p></section>
            {selectedContent.context && <section><h3 className="dialog-sub">Đề bài và thông tin mô phỏng</h3><p className="prose muted">{selectedContent.context.trim()}</p></section>}
            <section className="reply"><h3 className="dialog-sub">Phản hồi{selected.responderName ? " từ " + selected.responderName : ""}</h3>{selected.respondedAt && <small className="muted">{date(selected.respondedAt)}</small>}
              <p className="prose">{selected.adminResponse || "Chưa có phản hồi. Bạn có thể theo dõi kết quả xử lý tại đây."}</p></section>
          </div>}
          <div className="card-h" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-end" }}><Dialog.Close className="btn btn-primary">Đóng</Dialog.Close></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </main>;
}
