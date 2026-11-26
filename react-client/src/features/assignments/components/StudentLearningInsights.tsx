import { useId } from "react";
import { Button } from "@radix-ui/themes";
import type { Assignment } from "../../../shared/types/physlive";
import { studentAssignmentState } from "../model/studentAssignmentState";
import { useAssignmentClock } from "../hooks/useAssignmentClock";
import s from "./StudentLearningInsights.module.css";

type Props = { assignments: Assignment[]; loading: boolean; error: string; onSelect: (item: Assignment) => void };
const number = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
const chronological = (a: Assignment, b: Assignment) => Date.parse(a.completedAt || a.assignedAt) - Date.parse(b.completedAt || b.assignedAt);

export function StudentLearningResults({ assignments, loading, error, onSelect }: Readonly<Props>) {
  const id = useId();
  const now = useAssignmentClock();
  const submitted = assignments.filter(item => item.submissionCompleted && !item.retryAllowed && studentAssignmentState(item, now).key !== "expired").length;
  const graded = assignments.filter(item => item.gradingStatus === "TEACHER_CONFIRMED" && item.score != null && Number.isFinite(item.score) && (item.maxScore ?? 10) > 0 && !item.retryAllowed).sort(chronological);
  const average = graded.length ? graded.reduce((sum, item) => sum + item.score! / (item.maxScore ?? 10) * 10, 0) / graded.length : null;
  const recent = graded.slice(-5);
  const points = recent.map((item, i) => ({ item, x: recent.length === 1 ? 250 : 40 + i * 420 / (recent.length - 1), y: 200 - Math.max(0, Math.min(10, item.score! / (item.maxScore ?? 10) * 10)) * 17 }));
  const path = points.map((point, i) => (i ? "L" : "M") + point.x + " " + point.y).join(" ");
  const percent = assignments.length ? submitted / assignments.length * 100 : 0;
  return <section className={s.panel} aria-label="Kết quả học tập">
    <header className={s.heading}><h2>Kết quả học tập</h2><span>{average == null ? "Chưa có điểm chính thức" : "Trung bình " + number(average) + " / 10"}</span></header>
    {loading ? <p role="status" className={s.empty}>Đang tải kết quả…</p> : error ? <p role="alert" className={s.empty}>Chưa tải được dữ liệu học tập.</p> : <>
      <div className={s.progress}><div className={s.ring} style={{ background: "conic-gradient(var(--teal-9) " + percent + "%, var(--gray-3) 0)" }} role="img" aria-label={submitted + " trên " + assignments.length + " bài đã nộp"}><div><strong>{submitted}/{assignments.length}</strong><small>đã nộp</small></div></div><ul><li><i /><span>Đã nộp</span><strong>{submitted}</strong></li><li><i /><span>Đã chấm chính thức</span><strong>{graded.length}</strong></li></ul></div>
      {points.length ? <><p className={s.description}>Điểm 5 bài đã chấm gần nhất · thang 10 · cũ đến mới</p><svg className={s.chart} viewBox="0 0 500 235" role="img" aria-label={recent.map(item => item.title + ": " + number(item.score! / (item.maxScore ?? 10) * 10) + "/10").join("; ")}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--teal-9)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--teal-9)" stopOpacity=".02" /></linearGradient></defs>
        {[0,5,10].map(value => <g key={value}><line x1="40" x2="460" y1={200-value*17} y2={200-value*17} stroke="var(--gray-5)" strokeDasharray="3 4" /><text x="25" y={204-value*17} textAnchor="end">{value}</text></g>)}
        {points.length > 1 && <><path d={path + " L460 200 L40 200 Z"} fill={"url(#" + id + ")"} /><path d={path} fill="none" stroke="var(--teal-9)" strokeWidth="2.5" /></>}
        {points.map((point,i) => <g key={point.item.id}><circle cx={point.x} cy={point.y} r="5" fill="var(--teal-9)" stroke="var(--color-panel-solid)" strokeWidth="2"><title>{point.item.title + ": " + number(point.item.score! / (point.item.maxScore ?? 10) * 10) + "/10"}</title></circle><text x={point.x} y={point.y - 12} textAnchor="middle">{number(point.item.score! / (point.item.maxScore ?? 10) * 10)}</text><text x={point.x} y="223" textAnchor="middle">Bài {i+1}</text></g>)}
      </svg><div className={s.scoreLegend}>{recent.map((item,i) => <Button key={item.id} variant="ghost" size="1" title={item.title} onClick={() => onSelect(item)}>{i+1}. {item.title}</Button>)}</div></> : <p className={s.empty}>Điểm sẽ xuất hiện sau khi giáo viên xác nhận chấm bài.</p>}
    </>}
  </section>;
}

export function StudentStudyArt() {
  return <svg viewBox="0 0 210 120" className={s.art} aria-hidden="true"><ellipse cx="113" cy="100" rx="77" ry="13" fill="var(--teal-3)" /><path d="M50 16h112M106 16v68" stroke="#86a6b8" strokeWidth="2" /><path d="M50 10l6 6m7-6 6 6m7-6 6 6m7-6 6 6m7-6 6 6m7-6 6 6m7-6 6 6m7-6 6 6m7-6 6 6" stroke="#b5c8d4" /><path d="M106 16l28 66" stroke="#65929c" strokeWidth="2" /><path d="M76 86q30 19 60-4" fill="none" stroke="#6eafb7" strokeDasharray="2 4" /><circle cx="134" cy="83" r="11" fill="#23919a" /><circle cx="130" cy="79" r="3" fill="#9ad9da" /><path d="M38 81h30m-15-15v30" stroke="#86bac3" /><circle cx="170" cy="43" r="4" fill="#a4c9dd" /></svg>;
}
