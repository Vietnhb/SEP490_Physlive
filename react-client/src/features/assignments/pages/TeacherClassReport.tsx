import { useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import PageActions from "../../../shared/layout/PageActions";
import { useResource } from "../../../shared/hooks/operationsData";
import type { TeacherClassOption } from "../../../shared/types/physlive";
import { apiMessage } from "../../../shared/lib/apiError";
import { classReportUrl, downloadClassReport, type ClassReport, type ClassReportFilters } from "../api/classReportApi";
import StudioTableSkeleton from "../components/StudioTableSkeleton";

const defaults: ClassReportFilters = { query: "", status: "ALL", from: "", to: "" };
const number = (value: number | null | undefined) => value == null ? "—" : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("vi-VN") : "Không giới hạn";
const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const HEADERS = ["Bài tập", "Được giao", "Đã nộp", "Chưa nộp", "Nộp trễ", "Chờ chấm", "Điểm TB", "Hạn", "Trạng thái"];

/** The old address of the results page: open the class itself on its report tab (the first class when none is named). */
export default function TeacherClassReport() {
  const classes = useResource<TeacherClassOption[]>("/assignments/mine/teacher/classes");
  const [params] = useSearchParams();
  if (classes.loading) return <main className="page"><section className="card"><StudioTableSkeleton headers={["Bài tập", "Đã nộp", "Điểm trung bình"]} label="Đang mở báo cáo…" /></section></main>;
  const wanted = params.get("classId");
  const target = classes.data?.find(item => item.id === wanted) ?? classes.data?.[0];
  return <Navigate replace to={target ? `/lab/classes/${target.id}?tab=report` : "/lab/classes"} />;
}

/** One class's results — the canvas artboard "Báo cáo kết quả", shown as the report tab of the class. */
export function ClassReportPanel({ classId }: Readonly<{ classId: string }>) {
  return <Report classId={classId} permitted />;
}

function Report({ classId, permitted }: Readonly<{ classId: string; permitted: boolean }>) {
  const [draft, setDraft] = useState(defaults), [filters, setFilters] = useState(defaults);
  const [page, setPage] = useState(0), [size, setSize] = useState(10);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false); const exportLock = useRef(false);
  const report = useResource<ClassReport>(classReportUrl(classId, filters, page, size), permitted);
  const data = report.data, summary = data?.summary;
  const submit = (event: React.FormEvent) => { event.preventDefault(); setNotice(""); if (draft.from && draft.to && draft.from > draft.to) { setError("Từ ngày phải trước hoặc bằng đến ngày."); return; } setError(""); setPage(0); setFilters({ ...draft, query: draft.query.trim() }); };
  const clear = () => { setDraft(defaults); setFilters(defaults); setPage(0); setError(""); setNotice(""); };
  const exportCsv = async () => { if (exportLock.current) return; exportLock.current = true; setExporting(true); setError(""); setNotice(""); try { await downloadClassReport(classId, filters); setNotice("Đã xuất CSV toàn bộ bài tập theo bộ lọc đang áp dụng."); } catch (cause) { setError(apiMessage(cause, "Không thể xuất báo cáo. Vui lòng thử lại.")); } finally { exportLock.current = false; setExporting(false); } };
  const busy = report.loading || Boolean(report.error);
  const kpis = [
    { l: "Bài tập", v: busy ? "—" : number(summary?.assignments), h: "Theo bộ lọc ngày giao bài" },
    { l: "Lượt nộp / lượt giao", v: busy || !summary ? "—" : number(summary.submitted) + " / " + number(summary.recipients), h: summary?.submissionRate == null ? "Chưa có lượt giao" : number(summary.submissionRate) + "% đã nộp" },
    { l: "Bài nộp chờ chấm", v: busy ? "—" : number(summary?.awaitingGrade), h: "Gồm điểm chưa được xác nhận" },
    { l: "Điểm trung bình /10", v: busy ? "—" : number(summary?.average10), h: "Điểm chính thức và 0 do quá hạn" },
  ];
  const share = summary && summary.recipients ? summary.submitted / summary.recipients : 0;
  const bars = (data?.items ?? []).slice(0, 8);
  const tone = (value: number | null) => value == null ? "var(--subtle)" : value >= 8 ? "var(--brand)" : value >= 6.5 ? "#7C8FD6" : "#D9A54A";
  const field = (label: string, control: React.ReactNode) => <label className="field"><span>{label}</span>{control}</label>;

  return <>
    <PageActions><button type="button" className="btn btn-sm btn-ghost" onClick={() => void report.refresh()} disabled={report.refreshing}>{icon("refresh")}Làm mới</button></PageActions>
    <form className="card" aria-label="Bộ lọc báo cáo lớp" style={{ overflow: "visible" }} onSubmit={submit}>
      <div className="card-b" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, alignItems: "end" }}>
        {field("Tìm bài tập", <input className="input" type="search" placeholder="Tên bài tập…" maxLength={160} value={draft.query} onChange={event => setDraft({ ...draft, query: event.target.value })} />)}
        {field("Từ ngày giao", <input className="input" type="date" min="1900-01-01" max="9998-12-31" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} />)}
        {field("Đến ngày giao", <input className="input" type="date" min="1900-01-01" max="9998-12-31" value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} />)}
        {field("Trạng thái", <select className="input" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="ALL">Tất cả</option><option value="ACTIVE">Đang mở</option><option value="CLOSED">Đã đóng</option></select>)}
        <span className="actions" style={{ gap: 8 }}><button type="submit" className="btn btn-primary">Áp dụng</button><button type="button" className="btn btn-ghost" onClick={clear}>Xóa bộ lọc</button></span>
      </div>
    </form>
    {!permitted ? <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start" }}>Lớp không thuộc danh sách đang phụ trách. Hãy chọn một lớp khác.</p> : <>
      {error && <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start" }}>{error}</p>}
      {notice && <p className="badge b-success" role="status" style={{ alignSelf: "flex-start" }}>{notice}</p>}
      <section className="stats" aria-label="Tổng hợp kết quả">{kpis.map(k => <div className="stat" key={k.l}><i className="stat-ic" data-k={k.l} aria-hidden="true"></i><span className="stat-l">{k.l}</span><span className="stat-v">{k.v}</span><span className="stat-h">{k.h}</span></div>)}</section>
      {summary && !report.error && !report.loading && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 20 }}>
        <section className="card" aria-labelledby="rp-sub">
          <div className="card-h"><div><h2 className="h2" id="rp-sub">Tình hình nộp bài</h2><p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Toàn bộ lượt giao theo bộ lọc.</p></div></div>
          <div className="card-b" style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
            <svg viewBox="0 0 120 120" width="150" height="150" role="img" aria-label={`${summary.submitted} trên ${summary.recipients} lượt giao đã nộp, ${summary.notSubmitted} chưa nộp`}>
              <circle cx="60" cy="60" r="46" fill="none" stroke="var(--subtle)" strokeWidth="14" />
              <circle cx="60" cy="60" r="46" fill="none" stroke="var(--brand)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(share * 289).toFixed(1)} 289`} transform="rotate(-90 60 60)" />
              <text x="60" y="58" textAnchor="middle" style={{ font: "600 22px var(--font)", fill: "var(--text)" }}>{Math.round(share * 100)}%</text>
              <text x="60" y="76" textAnchor="middle" style={{ font: "400 10px var(--font)", fill: "var(--text-3)" }}>đã nộp</text>
            </svg>
            <ul style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13, listStyle: "none", margin: 0, padding: 0 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 10 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--brand)" }}></i><span style={{ minWidth: 70 }}>Đã nộp</span><b style={{ fontWeight: 600 }}>{number(summary.submitted)}</b><span className="muted">lượt giao</span></li>
              <li style={{ display: "flex", alignItems: "center", gap: 10 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--subtle)", border: "1px solid var(--border)" }}></i><span style={{ minWidth: 70 }}>Chưa nộp</span><b style={{ fontWeight: 600 }}>{number(summary.notSubmitted)}</b><span className="muted">gồm trả làm lại, quá hạn</span></li>
            </ul>
          </div>
        </section>
        <section className="card" aria-labelledby="rp-avg">
          <div className="card-h"><div><h2 className="h2" id="rp-avg">Điểm trung bình từng bài</h2><p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Tối đa 8 bài trên trang hiện tại · điểm chính thức, thang 10.</p></div></div>
          <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>{bars.length ? bars.map(item => <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr) 44px", alignItems: "center", gap: 12, fontSize: 13 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.title}>{item.title}</span>
            <span className="bar" style={{ height: 10 }}><i style={{ width: (item.average10 ?? 0) * 10 + "%", background: tone(item.average10) }}></i></span>
            <b style={{ fontWeight: 500, textAlign: "right" }}>{number(item.average10)}</b></div>) : <span className="muted">Chưa có bài tập.</span>}</div>
        </section>
      </div>}
      <section className="card" aria-label="Danh sách kết quả bài tập">
        <div className="card-h"><div><h2 className="h2">Kết quả bài tập{data?.className ? " · " + data.className : ""}</h2>{data && <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>Năm học {data.schoolYear} · Cập nhật {new Date(data.asOf).toLocaleString("vi-VN")}</p>}</div>
          <span className="actions" style={{ gap: 8 }}><button type="button" className="btn btn-sm" onClick={() => void exportCsv()} disabled={exporting || report.loading || Boolean(report.error) || !data?.totalElements}>{icon("download")}{exporting ? "Đang xuất…" : "Xuất CSV"}</button></span></div>
        <div className="toolbar" style={{ justifyContent: "space-between" }}><span className="muted" style={{ fontSize: 13 }}>{data?.totalElements ?? 0} bài tập phù hợp bộ lọc</span>
          <span className="muted" style={{ fontSize: 12, display: "inline-flex", gap: 6, alignItems: "center" }} title="Gồm học sinh đã rời lớp. Chưa nộp gồm bài trả làm lại và quá hạn không nộp. Điểm TB quy về thang 10, không tính điểm tạm tính.">{icon("alert")}Cách tính số liệu: gồm học sinh đã rời lớp · chưa nộp gồm trả làm lại và quá hạn · không tính điểm tạm</span></div>
        {report.error ? <div className="card-b" role="alert" style={{ display: "flex", gap: 12, alignItems: "center" }}>{report.error}<button type="button" className="btn btn-sm" onClick={() => void report.refresh()}>Thử lại</button></div>
          : report.loading ? <StudioTableSkeleton headers={HEADERS} label="Đang tải báo cáo…" />
          : !data?.items.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>Không có bài tập phù hợp bộ lọc.</p>
          : <div className="table-scroll" aria-busy={report.refreshing}><table className="table">
            <thead><tr>{HEADERS.map((header, index) => <th scope="col" key={header} className={index > 0 && index < 7 ? "num" : undefined}>{header}</th>)}<th scope="col"><span className="sr">Thao tác</span></th></tr></thead>
            <tbody>{data.items.map(item => <tr key={item.id}>
              <th scope="row" style={{ minWidth: 240, whiteSpace: "normal", lineHeight: 1.4 }}>{item.title}<small className="muted" style={{ display: "block", fontWeight: 400, fontSize: 12 }}>{item.assignedBy} · Giao {date(item.assignedAt)}</small></th>
              <td className="num">{number(item.recipients)}</td><td className="num">{number(item.submitted)}</td><td className="num">{number(item.notSubmitted)}</td><td className="num">{number(item.late)}</td>
              <td className="num"><span className={"badge" + (item.awaitingGrade ? " b-warn" : "")}>{number(item.awaitingGrade)}</span></td>
              <td className="num">{number(item.average10)}</td><td className="muted">{date(item.dueAt)}</td>
              <td><span className={"badge " + (item.status === "ACTIVE" ? "b-success" : "")}>{item.status === "ACTIVE" ? "Đang mở" : "Đã đóng"}</span></td>
              <td className="num"><Link className="btn btn-sm btn-ghost" to={"/lab/classes/" + classId + "?tab=assignments&assignment=" + encodeURIComponent(item.id)}>Xem bài</Link></td>
            </tr>)}</tbody>
          </table></div>}
        {data && !report.error && <div className="pager"><span>{data.totalElements ? "Hiển thị " + (data.page * data.size + 1) + "–" + Math.min((data.page + 1) * data.size, data.totalElements) + " / " + data.totalElements + " bài tập" : "0 bài tập"}</span>
          <span className="actions" style={{ gap: 8, alignItems: "center" }}><label className="pager-size">Số bài/trang <select className="input" style={{ width: 72 }} value={size} onChange={event => { setSize(Number(event.target.value)); setPage(0); }}>{[5, 10, 20, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <button type="button" className="btn btn-sm" disabled={data.page === 0 || report.refreshing} onClick={() => setPage(data.page - 1)}>Trước</button><span>Trang {data.page + 1} / {Math.max(1, data.totalPages)}</span>
            <button type="button" className="btn btn-sm" disabled={data.page + 1 >= data.totalPages || report.refreshing} onClick={() => setPage(data.page + 1)}>Sau</button></span></div>}
      </section>
    </>}
  </>;
}
