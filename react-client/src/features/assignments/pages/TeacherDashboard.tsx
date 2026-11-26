import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import type { Assignment, AssignmentSubmission, TeacherClassOption } from "../../../shared/types/physlive";
import type { SimulationComplaint } from "../../support/api/supportApi";
import { assignmentSubmissions } from "../api/assignmentApi";
import { StudioIcon } from "./TeacherArea";

type Progress = { assignmentId: string; recipients: number; submitted: number; awaitingGrade: number; confirmed: number };

const DAY = 86_400_000;
const DAYS = 14;
const pct = (a: number, b: number) => (b ? Math.round(a / b * 100) : 0) + "%";
const dm = (time: number) => new Date(time).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
const greeting = (hour: number) => hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
/** Vietnamese names end with the given name: "Nguyễn Thu Hà" → "Hà". */
const givenName = (full?: string) => full?.trim().split(/\s+/).at(-1) ?? "";

/* the canvas helpers (helpers.js): smoothed sparkline path and the bars of a day chart */
const smoothD = (P: number[][], lo: number, hi: number) => {
  const cl = (v: number) => Math.min(hi, Math.max(lo, v)).toFixed(2);
  return P.map((p, i) => {
    if (!i) return `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    const a = P[i - 2] || P[i - 1], b = P[i - 1], d = P[i + 1] || p;
    return `C${(b[0] + (p[0] - a[0]) / 6).toFixed(2)} ${cl(b[1] + (p[1] - a[1]) / 6)} ${(p[0] - (d[0] - b[0]) / 6).toFixed(2)} ${cl(p[1] - (d[1] - b[1]) / 6)} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  }).join(" ");
};
const spark = (vals: number[]) => {
  const w = 120, ht = 32, max = Math.max(...vals), min = Math.min(...vals), r = max - min || 1;
  const d = smoothD(vals.map((v, i) => [i / (vals.length - 1) * w, ht - 3 - (v - min) / r * (ht - 8)]), 1, ht - 1);
  return { d, ad: `${d} L${w} ${ht} L0 ${ht} Z` };
};

/**
 * Teacher overview — the canvas artboard "Giáo viên · Tổng quan", markup for markup, filled with the teacher's data:
 * greeting with what waits, figures, the work to do by urgency, submissions of the last 14 days and the classes.
 */
export default function TeacherDashboard() {
  const user = useSessionStore(state => state.user);
  const classes = useResource<TeacherClassOption[]>("/assignments/mine/teacher/classes");
  const work = useResource<Assignment[]>("/assignments/mine/teacher");
  const progress = useResource<Progress[]>("/assignments/mine/teacher/progress");
  const support = useResource<SimulationComplaint[]>("/support/mine");
  // the moment the page opened: deadlines and the 14 days are measured against it
  const [now] = useState(() => Date.now());
  const [handIns, setHandIns] = useState<number[] | null>(null);
  const assignments = work.data ?? [];
  const byId = new Map((progress.data ?? []).map(item => [item.assignmentId, item]));
  const rows = classes.data ?? [];

  // submissions per day: the hand-in time of every submission to the assignments of the last weeks
  const recentIds = assignments.filter(item => now - Date.parse(item.assignedAt) < 60 * DAY || item.status === "ACTIVE").map(item => item.id).join(",");
  useEffect(() => {
    if (!recentIds) return;
    let alive = true;
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const start = today.getTime() - (DAYS - 1) * DAY;
    Promise.all(recentIds.split(",").map(id => assignmentSubmissions(id).catch(() => [] as AssignmentSubmission[]))).then(lists => {
      const counts = Array.from({ length: DAYS }, () => 0);
      for (const item of lists.flat()) {
        const at = Date.parse(item.completedAt ?? "");
        if (Number.isFinite(at) && at >= start) counts[Math.min(DAYS - 1, Math.floor((at - start) / DAY))]++;
      }
      if (alive) setHandIns(counts);
    });
    return () => { alive = false; };
  }, [recentIds, now]);

  const open = assignments.filter(item => item.status === "ACTIVE");
  const awaiting = (progress.data ?? []).reduce((sum, item) => sum + item.awaitingGrade, 0);
  const awaitingAssignments = (progress.data ?? []).filter(item => item.awaitingGrade > 0).length;
  const overdue = open.filter(item => item.dueAt && Date.parse(item.dueAt) < now);
  const students = new Set(rows.flatMap(item => item.students.map(student => student.id))).size;
  const replied = (support.data ?? []).filter(item => item.kind === "COMPLAINT" && item.status === "READ" && item.adminResponse?.trim());
  const loading = work.loading || progress.loading;

  type Todo = { key: string; icon: string; kind: "danger" | "warn" | "info" | "brand"; title: string; sub: string; tag: string; href: string; rank: number };
  const handed = (item: Assignment) => { const p = byId.get(item.id); return p ? `${p.submitted}/${p.recipients} đã nộp` : ""; };
  const cls = (item: Assignment) => item.className || "Bài giao cá nhân";
  // an assignment is reviewed inside its class, on the tab that lists the submissions
  const review = (item: Assignment) => item.classId ? `/lab/classes/${item.classId}?tab=assignments&assignment=${encodeURIComponent(item.id)}` : "/lab/classes";
  const hours = (item: Assignment) => Math.max(1, Math.round((Date.parse(item.dueAt!) - now) / 3_600_000));
  const todo: Todo[] = [
    ...overdue.map(item => ({ key: "late" + item.id, icon: "alert", kind: "danger" as const, rank: 0, href: review(item),
      title: item.title, sub: [cls(item), "quá hạn " + dm(Date.parse(item.dueAt!)), handed(item)].filter(Boolean).join(" · "), tag: "Quá hạn" })),
    ...open.filter(item => (byId.get(item.id)?.awaitingGrade ?? 0) > 0 && !overdue.includes(item)).map(item => ({ key: "grade" + item.id, icon: "check", kind: "warn" as const, rank: 1,
      href: review(item), title: item.title, sub: [cls(item), handed(item), item.dueAt ? "hạn " + dm(Date.parse(item.dueAt)) : ""].filter(Boolean).join(" · "),
      tag: `${byId.get(item.id)!.awaitingGrade} chờ chấm` })),
    ...open.filter(item => item.dueAt && Date.parse(item.dueAt) >= now && Date.parse(item.dueAt) - now < 2 * DAY && !(byId.get(item.id)?.awaitingGrade)).map(item => ({
      key: "soon" + item.id, icon: "clock", kind: "warn" as const, rank: 2, href: review(item), title: item.title,
      sub: [cls(item), handed(item), "hạn " + new Date(Date.parse(item.dueAt!)).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })].filter(Boolean).join(" · "),
      tag: `Còn ${hours(item)} giờ` })),
    ...assignments.filter(item => item.status !== "ACTIVE" && (byId.get(item.id)?.awaitingGrade ?? 0) > 0).map(item => ({ key: "closed" + item.id, icon: "check", kind: "info" as const, rank: 3,
      href: review(item), title: item.title, sub: [cls(item), handed(item)].filter(Boolean).join(" · "), tag: `${byId.get(item.id)!.awaitingGrade} chờ chấm` })),
    ...replied.slice(0, 2).map(item => ({ key: "reply" + item.id, icon: "message", kind: "brand" as const, rank: 4, href: "/lab/complaints",
      title: `Khiếu nại “${item.subject || "Mô phỏng"}”`, sub: "Kiểm duyệt đã phản hồi" + (item.respondedAt ? " · " + dm(Date.parse(item.respondedAt)) : ""), tag: "Có phản hồi" })),
  ].sort((a, b) => a.rank - b.rank).slice(0, 5);
  const tone = { danger: "b-danger", warn: "b-warn", info: "b-info", brand: "b-brand" };

  const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime() - (DAYS - 1 - i) * DAY; });
  const flow = handIns ?? Array.from({ length: DAYS }, () => 0);
  const flowMax = Math.max(1, ...flow);
  const labels = days.map((time, i) => i === 0 || i === DAYS - 1 ? dm(time) : String(new Date(time).getDate()).padStart(2, "0"));
  const sparkPath = handIns && handIns.some(Boolean) ? spark(handIns) : null;
  const dash = (busy: boolean, error: unknown, value: number) => busy || error ? "—" : value.toLocaleString("vi-VN");
  const stats = [
    { label: "Bài nộp cần chấm", value: dash(progress.loading, progress.error, awaiting), hint: `${awaitingAssignments} bài tập có bài nộp chờ chấm`, href: "/lab/classes", spark: sparkPath },
    { label: "Bài đang mở", value: dash(work.loading, work.error, open.length), hint: `Trong ${assignments.length} bài đã giao`, href: "/lab/classes", spark: null },
    { label: "Lớp phụ trách", value: dash(classes.loading, classes.error, rows.length), hint: `${students} học sinh`, href: "/lab/classes", spark: null },
  ];
  const sub = loading ? "Đang tải việc cần làm…"
    : [awaiting ? `${awaiting} bài nộp đang chờ chấm` : "Không có bài nộp nào đang chờ chấm", overdue.length ? `${overdue.length} bài vừa quá hạn` : ""].filter(Boolean).join(", ") + ".";
  const today = new Date(now).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return <main className="page" data-analytics="dashboard" data-dashboard-role="teacher">
    <div className="ph ph-feature art-projectile"><div><p className="eyebrow">{today.charAt(0).toUpperCase() + today.slice(1)}</p><h1 className="h1">{greeting(new Date(now).getHours())}{givenName(user?.fullName) ? ", " + givenName(user?.fullName) : ""}</h1><p className="sub">{sub}</p></div><div className="actions"><Link className="btn btn-primary" to="/lab"><StudioIcon name="check" />Chấm bài</Link></div></div>

    <section className="stats" aria-label="Số liệu tổng quan">{stats.map(s => <Link className="stat" to={s.href} key={s.label}>
      <i className="stat-ic" data-k={s.label} aria-hidden="true"></i><span className="stat-l">{s.label}</span><span className="stat-v">{s.value}</span><span className="stat-h">{s.hint}</span>
      <svg className="spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true" style={{ display: s.spark ? "block" : "none" }}><path className="spark-area" d={s.spark?.ad} /><path className="spark-line" d={s.spark?.d} /></svg>
    </Link>)}</section>

    <div className="split">
      <section className="card" style={{ flex: "1.3 1 460px", minWidth: 0 }} aria-labelledby="todo">
        <div className="card-h"><h2 className="h2" id="todo">Việc cần làm</h2><span className="muted" style={{ fontSize: 12 }}>Xếp theo mức gấp</span></div>
        {work.error || progress.error ? <p className="muted" role="alert" style={{ padding: "12px 20px" }}>{String(work.error || progress.error)}</p>
          : loading ? <p className="muted" style={{ padding: "12px 20px" }}>Đang tải…</p>
          : todo.length ? <ul className="rows">{todo.map(t => <li key={t.key}><Link className="row" to={t.href}>
              <span className="todo-ic" style={{ "--ic": t.kind === "brand" ? "var(--brand-text)" : `var(--${t.kind})`, "--ic-bg": `var(--${t.kind}-soft)` } as React.CSSProperties}><StudioIcon name={t.icon} /></span>
              <span className="row-t"><b>{t.title}</b><small>{t.sub}</small></span><span className={"badge " + tone[t.kind]}>{t.tag}</span><StudioIcon name="chevron" style={{ color: "var(--text-3)" }} />
            </Link></li>)}</ul>
          : <p className="muted" style={{ padding: "12px 20px 20px" }}>Không có việc gấp: mọi bài nộp đã được chấm và chưa có bài nào sắp đến hạn.</p>}
      </section>
      <div className="col" style={{ flex: "1 1 360px" }}>
        <section className="card" aria-labelledby="flow"><div className="card-h"><h2 className="h2" id="flow">Bài nộp 14 ngày qua</h2><span className="muted" style={{ fontSize: 12 }}>Hôm nay {handIns ? flow[DAYS - 1] : "…"}</span></div><div className="card-b" style={{ paddingTop: 12 }}>
          <div className="vbars" role="img" aria-label={`Bài nộp mỗi ngày từ ${dm(days[0])} đến ${dm(days[DAYS - 1])}: ${flow.join(", ")}`} style={{ height: 120 }}>
            {flow.map((v, i) => <span key={days[i]} title={`${labels[i]}: ${v}`}><b></b><i className={i === DAYS - 1 ? "hl" : ""} style={{ height: Math.max(2, Math.round(v / flowMax * 92)) + "px", animationDelay: i * 40 + "ms" }}></i><small>{i % 4 === 0 || i === DAYS - 1 ? labels[i] : ""}</small></span>)}
          </div></div></section>
        <section className="card" aria-labelledby="classes"><div className="card-h"><h2 className="h2" id="classes">Lớp phụ trách</h2><Link className="link" to="/lab/classes">Tất cả</Link></div>
          <ul className="rows">{rows.slice(0, 4).map(c => {
            const mine = open.filter(item => item.classId === c.id);
            const done = mine.reduce((sum, item) => sum + (byId.get(item.id)?.submitted ?? 0), 0);
            const given = mine.reduce((sum, item) => sum + (byId.get(item.id)?.recipients ?? 0), 0);
            return <li key={c.id}><Link className="row" to={"/lab/classes/" + c.id}><span className="tile">{c.gradeLevel}</span><span className="row-t"><b>{c.name}</b><small>{c.students.length} học sinh · {mine.length} bài đang mở</small></span>
              <span className="progress" style={{ width: 96 }}><small>{given ? `${done}/${given} đã nộp` : "Chưa có bài mở"}</small><span className="bar"><i style={{ width: pct(done, given) }}></i></span></span></Link></li>;
          })}{!classes.loading && !rows.length && <li className="muted" style={{ padding: "8px 12px" }}>Bạn chưa được phân công lớp nào.</li>}</ul>
        </section>
      </div>
    </div>
  </main>;
}
