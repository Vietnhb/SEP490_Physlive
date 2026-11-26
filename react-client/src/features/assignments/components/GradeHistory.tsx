import { useState } from "react";
import { useResource } from "../../../shared/hooks/operationsData";
import type { DataPage } from "../../../shared/api/page";
import s from "./GradeHistory.module.css";

type Change = {
  id: string; createdAt: string; actorName: string; eventType: "GRADED" | "AUTO_GRADED" | "REOPENED";
  previousScore: number | null; newScore: number | null; previousFeedback: string | null; newFeedback: string | null;
  previousStatus: string | null; previousGraderName: string | null; previousGradedAt: string | null; reason: string | null;
};
const labels = { GRADED: "Chấm / xác nhận điểm", AUTO_GRADED: "Chấm tự động", REOPENED: "Trả bài làm lại" };
const score = (value: number | null) => value == null ? "Chưa có điểm" : String(value);
const date = (value: string) => new Date(value).toLocaleString("vi-VN");

export default function GradeHistory({ assignmentId, submissionId, canvas = false }: Readonly<{ assignmentId: string; submissionId: string; canvas?: boolean }>) {
  const [page, setPage] = useState(0);
  const resource = useResource<DataPage<Change>>("/assignments/" + assignmentId + "/submissions/" + submissionId + "/grade-history?page=" + page + "&size=10");
  // inside the canvas (teacher area) the history uses the studio's own pieces instead of this module's styles
  if (canvas) return <section className="grade-history" aria-label="Lịch sử chấm và sửa điểm">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><b style={{ fontWeight: 600 }}>Lịch sử chấm và sửa điểm</b>
      <button type="button" className="btn btn-sm btn-ghost" disabled={resource.refreshing} onClick={() => void resource.refresh()}><svg className="icon" aria-hidden="true"><use href="#i-refresh" /></svg>Làm mới</button></div>
    {resource.error && <p className="badge b-danger" role="alert" style={{ margin: 0 }}>{resource.error}</p>}
    {resource.loading && <p className="muted" role="status" style={{ margin: 0 }}>Đang tải lịch sử điểm…</p>}
    {resource.data && (resource.data.items.length === 0 ? <p className="muted" style={{ margin: 0 }}>Chưa có lịch sử được ghi nhận. Với điểm có sẵn trước khi bật chức năng này, lịch sử bắt đầu từ lần thay đổi tiếp theo.</p>
      : <ol className="grade-events">{resource.data.items.map(item => <li key={item.id}>
        <div className="grade-event-h"><b>{item.actorName}</b><span className="badge">{labels[item.eventType]}</span><time className="muted" dateTime={item.createdAt}>{date(item.createdAt)}</time></div>
        <p className="grade-event-score">{score(item.previousScore)} <span className="muted" aria-label="chuyển thành">→</span> <b>{score(item.newScore)}</b></p>
        {item.previousScore != null && <small className="muted">Người chấm trước: {item.previousGraderName || (item.previousStatus === "AI_GRADED" ? "Hệ thống" : "Chưa ghi nhận")}{item.previousGradedAt ? " · " + date(item.previousGradedAt) : ""}</small>}
        <div className="grade-event-fb"><div><small className="muted">Nhận xét trước</small><p>{item.previousFeedback || "Chưa có"}</p></div><div><small className="muted">Nhận xét sau</small><p>{item.newFeedback || "Chưa có"}</p></div></div>
        <small><b style={{ fontWeight: 500 }}>Lý do: </b>{item.reason || (item.previousScore == null ? "Chấm lần đầu" : "Không có lý do được ghi nhận")}</small>
      </li>)}</ol>)}
    {resource.data && resource.data.totalPages > 1 && <div className="actions" style={{ gap: 8, alignItems: "center", justifyContent: "flex-end" }}><button type="button" className="btn btn-sm" disabled={page === 0 || resource.refreshing} onClick={() => setPage(value => value - 1)}>Trước</button><span className="muted">Trang {page + 1}/{resource.data.totalPages}</span><button type="button" className="btn btn-sm" disabled={page + 1 >= resource.data.totalPages || resource.refreshing} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
  </section>;
  return <section className={s.history} aria-label="Lịch sử chấm và sửa điểm">
    <div className={s.heading}><h3>Lịch sử chấm và sửa điểm</h3><button type="button" className="secondary" disabled={resource.refreshing} onClick={() => void resource.refresh()}>Làm mới</button></div>
    {resource.error && <p role="alert">{resource.error}</p>}
    {resource.loading && <p role="status">Đang tải lịch sử điểm…</p>}
    {resource.data && <>
      {resource.data.items.length === 0 ? <p className={s.empty}>Chưa có lịch sử được ghi nhận. Với điểm có sẵn trước khi bật chức năng này, lịch sử sẽ bắt đầu từ lần thay đổi tiếp theo.</p> : <ol className={s.entries}>{resource.data.items.map(item => <li key={item.id}>
        <div className={s.event}><strong>{item.actorName}</strong><span>{labels[item.eventType]}</span><time dateTime={item.createdAt}>{date(item.createdAt)}</time></div>
        <p className={s.scores}>{score(item.previousScore)} <span aria-label="chuyển thành">→</span> {score(item.newScore)}</p>
        {item.previousScore != null && <p className={s.previous}>Người chấm trước: {item.previousGraderName || (item.previousStatus === "AI_GRADED" ? "Hệ thống" : "Chưa ghi nhận")}{item.previousGradedAt ? " · " + date(item.previousGradedAt) : ""}</p>}
        <div className={s.feedback}><div><span>Nhận xét trước</span><p>{item.previousFeedback || "Chưa có"}</p></div><div><span>Nhận xét sau</span><p>{item.newFeedback || "Chưa có"}</p></div></div>
        <p className={s.reason}><strong>Lý do: </strong>{item.reason || (item.previousScore == null ? "Chấm lần đầu" : "Không có lý do được ghi nhận")}</p>
      </li>)}</ol>}
      {resource.data.totalPages > 1 && <div className={s.paging}><button type="button" className="secondary" disabled={page === 0 || resource.refreshing} onClick={() => setPage(value => value - 1)}>Trước</button><span>Trang {page + 1}/{resource.data.totalPages}</span><button type="button" className="secondary" disabled={page + 1 >= resource.data.totalPages || resource.refreshing} onClick={() => setPage(value => value + 1)}>Sau</button></div>}
    </>}
  </section>;
}
