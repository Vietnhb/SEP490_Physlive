import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import type { Assignment, LibraryItem } from "../../../shared/types/physlive";
import StudioTableSkeleton from "../../assignments/components/StudioTableSkeleton";
import { picture, verification } from "../model/libraryVisuals";

const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const DAY = 86_400_000;

const sharing = (item: LibraryItem, own: boolean) => {
  if (item.visibility === "PERSONAL") return { label: "Chỉ mình tôi", tone: "" };
  const scope = item.visibility === "PUBLIC" ? "Kho cộng đồng" : "Trong trường";
  if (!own) return { label: scope, tone: item.visibility === "PUBLIC" ? "b-success" : "b-info" };
  if (item.moderationStatus === "PENDING") return { label: scope + " · chờ duyệt", tone: "b-warn" };
  if (item.moderationStatus === "REJECTED") return { label: scope + " · bị từ chối", tone: "b-danger" };
  return { label: scope + (item.visibility === "PUBLIC" ? " · đã duyệt" : ""), tone: item.visibility === "PUBLIC" ? "b-success" : "b-info" };
};
const spark = (vals: number[]) => {
  const w = 120, ht = 32, max = Math.max(...vals), min = Math.min(...vals), r = max - min || 1;
  const P = vals.map((v, i) => [i / (vals.length - 1) * w, ht - 3 - (v - min) / r * (ht - 8)]);
  const cl = (v: number) => Math.min(ht - 1, Math.max(1, v)).toFixed(2);
  const d = P.map((p, i) => {
    if (!i) return `M${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
    const a = P[i - 2] || P[i - 1], b = P[i - 1], n = P[i + 1] || p;
    return `C${(b[0] + (p[0] - a[0]) / 6).toFixed(2)} ${cl(b[1] + (p[1] - a[1]) / 6)} ${(p[0] - (n[0] - b[0]) / 6).toFixed(2)} ${cl(p[1] - (n[1] - b[1]) / 6)} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  }).join(" ");
  return { d, ad: `${d} L${w} ${ht} L0 ${ht} Z` };
};

/** One row's "more" menu, the canvas's .menu with the actions the library really has. */
function RowMenu({ item }: Readonly<{ item: LibraryItem }>) {
  const [open, setOpen] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    const close = () => setOpen(null);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", key); addEventListener("scroll", close, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); removeEventListener("scroll", close, true); };
  }, [open]);
  return <span ref={box} style={{ position: "relative" }}>
    <button type="button" className="btn btn-sm btn-icon" aria-label="Thao tác khác" aria-haspopup="menu" aria-expanded={Boolean(open)} onClick={event => { const r = event.currentTarget.getBoundingClientRect(); setOpen(value => value ? null : { top: r.bottom + 4, right: innerWidth - r.right }); }}>{icon("more")}</button>
    {open && <div className="menu" role="menu" aria-label={item.title} style={{ position: "fixed", top: open.top, right: open.right, zIndex: 50 }}>
      <button type="button" role="menuitem" onClick={() => navigate(`/workspace?simulationId=${encodeURIComponent(item.simulationId)}`)}>{icon("eye")}Mở mô phỏng</button>
      <button type="button" role="menuitem" onClick={() => navigate(`/assignments/workspace?libraryItemId=${encodeURIComponent(item.id)}`)}>{icon("file")}Giao bài</button>
    </div>}
  </span>;
}

/**
 * Teacher library — the canvas artboard "Giáo viên · Mô phỏng của tôi", markup for markup: figures, the saved and
 * shared simulations, and how they spread over topics and sharing scopes.
 */
export default function TeacherLibrary() {
  const topicName = useTopicName();
  const mineResource = useResource<LibraryItem[]>("/library/mine");
  const accessibleResource = useResource<LibraryItem[]>("/library");
  const work = useResource<Assignment[]>("/assignments/mine/teacher");
  const [tab, setTab] = useState<"mine" | "shared">("mine");
  const [now] = useState(() => Date.now());
  const mine = useMemo(() => [...(mineResource.data ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)), [mineResource.data]);
  const mineIds = useMemo(() => new Set(mine.map(item => item.id)), [mine]);
  const shared = (accessibleResource.data ?? []).filter(item => item.visibility !== "PERSONAL" && !mineIds.has(item.id));
  const month = new Date(now); month.setDate(1); month.setHours(0, 0, 0, 0);
  const thisMonth = mine.filter(item => Date.parse(item.createdAt) >= month.getTime()).length;
  const community = mine.filter(item => item.visibility === "PUBLIC");
  const pending = community.filter(item => item.moderationStatus === "PENDING").length;
  const given = (work.data ?? []).filter(item => mineIds.has(item.libraryItemId));
  const classes = new Set(given.map(item => item.classId).filter(Boolean)).size;
  // saved simulations over the last 10 weeks, as the canvas's sparkline
  const weeks = Array.from({ length: 10 }, (_, i) => mine.filter(item => Date.parse(item.createdAt) <= now - (9 - i) * 7 * DAY).length);
  const sparkPath = mine.length > 1 ? spark(weeks) : null;
  const dash = (busy: boolean, value: number) => busy ? "—" : value.toLocaleString("vi-VN");
  const stats = [
    { label: "Đã lưu", value: dash(mineResource.loading, mine.length), hint: `+${thisMonth} trong tháng này`, spark: sparkPath },
    { label: "Đã chia sẻ cộng đồng", value: dash(mineResource.loading, community.length), hint: `${pending} đang chờ duyệt`, spark: null },
    { label: "Lần được giao", value: dash(work.loading, given.length), hint: `Cho ${classes} lớp`, spark: null },
    { label: "Được chia sẻ với bạn", value: dash(accessibleResource.loading, shared.length), hint: "Từ giáo viên khác", spark: null },
  ];
  const byTopic = Object.entries(mine.reduce<Record<string, number>>((acc, item) => { const name = topicName(item.topic) || "Khác"; acc[name] = (acc[name] ?? 0) + 1; return acc; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const scopes: [string, number][] = [["Chỉ mình tôi", mine.filter(item => item.visibility === "PERSONAL").length], ["Trong trường", mine.filter(item => item.visibility === "SHARED").length], ["Kho cộng đồng", community.length]];
  const rows = tab === "mine" ? mine : shared;
  const loading = tab === "mine" ? mineResource.loading : accessibleResource.loading;
  const error = mineResource.error || accessibleResource.error;
  const headers = tab === "mine" ? ["Tên", "Chủ đề", "Chia sẻ", "Ngày lưu", ""] : ["Tên", "Chủ đề", "Chia sẻ", "Người chia sẻ", "Ngày lưu"];
  const hrow = (label: string, value: number, max: number, index: number) => <div className="hrow" key={label}><span><span>{label}</span><b>{value}</b></span><span className="bar"><i style={{ width: (max ? Math.round(value / max * 100) : 0) + "%", animationDelay: index * 70 + "ms" }}></i></span></div>;

  return <main className="page">
    <div className="ph ph-spot" style={{ "--spot": "url(/studio/il-library.svg)" } as React.CSSProperties}><div><h1 className="h1">Mô phỏng của tôi</h1><p className="sub">Mô phỏng bạn đã lưu và mô phỏng được chia sẻ với bạn. Chọn Giao bài để dùng cho lớp.</p></div><Link className="btn" to="/workspace">{icon("atom")}Tạo mô phỏng</Link></div>
    <section className="stats" aria-label="Chỉ số">{stats.map(s => <div className="stat" key={s.label}>
      <i className="stat-ic" data-k={s.label} aria-hidden="true"></i><span className="stat-l">{s.label}</span><span className="stat-v">{s.value}</span><span className="stat-h">{s.hint}</span>
      {s.spark && <svg className="spark" viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true"><path className="spark-area" d={s.spark.ad} /><path className="spark-line" d={s.spark.d} /></svg>}
    </div>)}</section>
    {error && <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start" }}>{String(error)}</p>}
    <div className="split"><div className="col" style={{ flex: "2.4 1 780px", gap: 16 }}>
      <div className="tabs" role="tablist">
        <button role="tab" type="button" aria-selected={tab === "mine"} onClick={() => setTab("mine")}>Đã lưu <span className="count">{mine.length}</span></button>
        <button role="tab" type="button" aria-selected={tab === "shared"} onClick={() => setTab("shared")}>Được chia sẻ với bạn <span className="count" style={tab === "shared" ? undefined : { background: "var(--subtle)", color: "var(--text-2)" }}>{shared.length}</span></button>
      </div>
      <section className="card" aria-label={tab === "mine" ? "Mô phỏng đã lưu" : "Mô phỏng được chia sẻ với bạn"}>
        {loading ? <StudioTableSkeleton headers={headers.filter(Boolean)} label="Đang tải thư viện…" />
          : !rows.length ? <p className="muted" style={{ padding: 20, margin: 0 }}>{tab === "mine" ? "Bạn chưa lưu mô phỏng nào. Dựng một mô phỏng rồi bấm “Lưu mô phỏng” để thấy ở đây." : "Chưa có mô phỏng nào được chia sẻ với bạn."}</p>
          : <div className="table-scroll"><table className="table">
            <thead><tr>{headers.map(header => <th scope="col" key={header || "actions"}>{header || <span className="sr">Thao tác</span>}</th>)}</tr></thead>
            <tbody>{rows.map(item => {
              const v = verification(item), s = sharing(item, tab === "mine");
              return <tr key={item.id}>
                <th scope="row" style={{ minWidth: 260 }}><span style={{ display: "flex", alignItems: "center", gap: 10 }}><img src={picture(item.topic)} alt="" style={{ width: 40, height: 30, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", flex: "none" }} />
                  <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", minWidth: 0 }}>
                    {tab === "mine" ? <Link to={`/workspace?simulationId=${encodeURIComponent(item.simulationId)}`} style={{ whiteSpace: "normal" }}>{item.title}</Link> : <span style={{ whiteSpace: "normal" }}>{item.title}</span>}
                    <span className={"badge " + v.tone} title={v.hint} style={{ fontSize: 11 }}>{v.label}</span></span></span></th>
                <td>{topicName(item.topic) || "—"}</td>
                <td><span className={"badge " + s.tone}>{s.label}</span></td>
                {tab === "shared" && <td>{item.sharedByName || "—"}{item.schoolName && <small className="muted" style={{ display: "block" }}>{item.schoolName}</small>}</td>}
                <td className="muted">{new Date(item.createdAt).toLocaleDateString("vi-VN")}</td>
                {tab === "mine" && <td className="num"><span className="actions" style={{ justifyContent: "flex-end" }}><Link className="btn btn-sm btn-primary" to={`/assignments/workspace?libraryItemId=${encodeURIComponent(item.id)}`}>Giao bài</Link><RowMenu item={item} /></span></td>}
              </tr>;
            })}</tbody>
          </table></div>}
      </section>
    </div><aside className="col insight-col" style={{ flex: "1 1 280px", gap: 16 }}>
      <section className="card"><div className="card-h"><h2 className="h2">Theo chủ đề</h2><span className="muted" style={{ fontSize: 12 }}>{mine.length} mô phỏng</span></div>
        <div className="card-b form" style={{ gap: 14 }}>{byTopic.length ? byTopic.map(([label, value], index) => hrow(label, value, byTopic[0][1], index)) : <span className="muted">Chưa có mô phỏng.</span>}</div></section>
      <section className="card"><div className="card-h"><h2 className="h2">Phạm vi chia sẻ</h2><span className="muted" style={{ fontSize: 12 }}></span></div>
        <div className="card-b form" style={{ gap: 14 }}>{scopes.map(([label, value], index) => hrow(label, value, Math.max(...scopes.map(entry => entry[1])), index))}</div></section>
    </aside></div>
  </main>;
}
