import { useMemo, useRef, useState } from "react";
import PageActions from "../../../shared/layout/PageActions";
import SimulationThumb from "../components/SimulationThumb";
import { ResourceViewerDialog } from "../components/ResourceDiscovery";
import { useCommunityLibrary } from "../hooks/useCommunityLibrary";
import { buildCatalog, filterLibrary, indexLessonPaths, type CatalogSelection, type LibraryScope } from "../model/catalogModel";

const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
type Sort = "latest" | "featured" | "title";
type TocRow = { key: string; label: string; count: number; depth: number; selection: CatalogSelection; current: boolean; grade?: boolean };

/** Teacher community — the canvas artboard "Kho cộng đồng": catalogue on the left, shared simulations on the right. */
export default function TeacherCommunity() {
  const library = useCommunityLibrary();
  const [selection, setSelection] = useState<CatalogSelection>({});
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<LibraryScope>("ALL");
  const [sort, setSort] = useState<Sort>("latest");
  const returnFocus = useRef<HTMLElement | null>(null);
  const catalog = useMemo(() => buildCatalog(library.curriculum), [library.curriculum]);
  const paths = useMemo(() => indexLessonPaths(catalog), [catalog]);
  const scoped = useMemo(() => filterLibrary(library.items, paths, {}, scope, ""), [library.items, paths, scope]);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of scoped) result.set(item.lessonId, (result.get(item.lessonId) ?? 0) + 1);
    return result;
  }, [scoped]);
  const visible = useMemo(() => filterLibrary(library.items, paths, selection, scope, query).sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "vi");
    if (sort === "featured") {
      const difference = Number(b.moderationStatus === "FEATURED") - Number(a.moderationStatus === "FEATURED");
      if (difference) return difference;
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  }), [library.items, paths, selection, scope, query, sort]);
  const stats = useMemo(() => [
    { label: "simulations", key: "Có mô phỏng", title: "Mô phỏng", hint: "Đã được duyệt để dùng chung", value: library.items.length },
    { label: "teachers", key: "Giáo viên", title: "Giáo viên chia sẻ", hint: "Trong trường và toàn hệ thống", value: new Set(library.items.map(item => item.sharedById ?? item.sharedByName).filter(Boolean)).size },
    { label: "lessons", key: "Bài học", title: "Bài học có mô phỏng", hint: "Theo chương trình Vật lý", value: new Set(library.items.map(item => item.lessonId).filter(Boolean)).size },
  ], [library.items]);

  // the outline: every grade, the chapters that hold something, and the lessons of the open chapter
  const toc = useMemo(() => {
    const rows: TocRow[] = [{ key: "all", label: "Tất cả mô phỏng", count: scoped.length, depth: 0, selection: {}, current: !selection.subjectId }];
    const sum = (lessons: { id: string }[]) => lessons.reduce((value, lesson) => value + (counts.get(lesson.id) ?? 0), 0);
    for (const subject of catalog) for (const grade of subject.grades) {
      const inGrade = selection.subjectId === subject.id && selection.grade === grade.name;
      rows.push({ key: subject.id + grade.name, label: grade.name, count: sum(grade.modules.flatMap(module => module.lessons)), depth: 0, grade: true,
        selection: { subjectId: subject.id, grade: grade.name }, current: inGrade && !selection.moduleId });
      for (const module of grade.modules) {
        const inModule = inGrade && selection.moduleId === module.id;
        const moduleCount = sum(module.lessons);
        if (!moduleCount && !inModule) continue;
        const base = { subjectId: subject.id, grade: grade.name, moduleId: module.id };
        rows.push({ key: subject.id + grade.name + module.id, label: module.name, count: moduleCount, depth: 1, selection: base, current: inModule && !selection.lessonId });
        if (inModule) for (const lesson of module.lessons) {
          const lessonCount = counts.get(lesson.id) ?? 0;
          if (lessonCount || selection.lessonId === lesson.id)
            rows.push({ key: lesson.id, label: lesson.name, count: lessonCount, depth: 2, selection: { ...base, lessonId: lesson.id }, current: selection.lessonId === lesson.id });
        }
      }
    }
    return rows;
  }, [catalog, counts, scoped.length, selection]);
  const subject = catalog.find(entry => entry.id === selection.subjectId);
  const grade = subject?.grades.find(entry => entry.name === selection.grade);
  const module = grade?.modules.find(entry => entry.id === selection.moduleId);
  const lesson = module?.lessons.find(entry => entry.id === selection.lessonId);
  const crumbs = ["Vật lý", grade?.name, module?.name, lesson?.name].filter(Boolean);
  const filtered = Boolean(query.trim() || selection.subjectId || scope !== "ALL");
  const reset = () => { setQuery(""); setSelection({}); setScope("ALL"); };
  const selectedPath = library.selectedItem ? paths.get(library.selectedItem.lessonId) : undefined;

  return <main className="page">
    <PageActions><button type="button" className="btn btn-sm btn-ghost" disabled={library.loading} onClick={() => void library.load()}>{icon("refresh")}Làm mới</button></PageActions>
    <div className="ph ph-spot" style={{ "--spot": "url(/studio/il-community.svg)" } as React.CSSProperties}><div><h1 className="h1">Kho cộng đồng</h1><p className="sub">Tìm mô phỏng theo bài học, xem thử và lưu về thư viện của bạn.</p></div></div>
    <section className="stats" aria-label="Chỉ số kho cộng đồng">{stats.map(stat => <div key={stat.label} className="stat">
      <i className="stat-ic" data-k={stat.key} aria-hidden="true"></i><span className="stat-l">{stat.title}</span>
      <span className="stat-v">{library.loading ? "—" : stat.value.toLocaleString("vi-VN")}</span><span className="stat-h">{stat.hint}</span></div>)}</section>
    <div className="disc">
      {catalog.length > 0 && <nav className="card toc" aria-label="Mục lục tài nguyên">
        <div className="card-h"><h2 className="h2">Mục lục</h2></div>
        <div className="card-b tree" style={{ padding: 8 }}>{toc.map(row => <button key={row.key} type="button" className={"tree-item" + (row.grade ? " is-grade" : "")} aria-current={row.current}
          style={{ paddingLeft: 8 + row.depth * 14 }} title={row.label} onClick={() => setSelection(row.selection)}><span>{row.label}</span><small>{row.count || ""}</small></button>)}</div>
      </nav>}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="toolbar" style={{ padding: 0, border: 0 }}>
          <label className="search"><span className="sr">Tìm tài nguyên</span>{icon("search")}<input className="input" type="search" placeholder="Tìm mô phỏng, bài học, giáo viên…" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <div className="seg" role="group" aria-label="Phạm vi chia sẻ">{([["ALL", "Tất cả"], ["PUBLIC", "Toàn hệ thống"], ["SHARED", "Trong trường"]] as const).map(([value, label]) =>
            <button key={value} type="button" aria-pressed={scope === value} onClick={() => setScope(value)}>{label}</button>)}</div>
          <select className="input" style={{ width: 140 }} aria-label="Sắp xếp tài nguyên" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="latest">Mới nhất</option><option value="featured">Nổi bật</option><option value="title">Tên A–Z</option></select>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }} aria-live="polite">
          <span>{crumbs.join(" › ")} · {library.loading ? "đang tải…" : visible.length + " mô phỏng"}</span>
          {filtered && !library.loading && <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>{icon("x")}Xóa bộ lọc</button>}</p>
        {library.error && library.items.length > 0 && <p className="badge b-danger" role="alert" style={{ alignSelf: "flex-start" }}>{library.error}</p>}
        {library.loading ? <div className="res" aria-label="Đang tải kho cộng đồng">{Array.from({ length: 6 }, (_, index) => <div key={index} className="card rcard" aria-hidden="true"><span className="thumb"><span className="sk" style={{ width: "80%", height: 90 }} /></span><span className="card-b"><span className="sk" style={{ width: "70%", height: 14 }} /><span className="sk" style={{ width: "45%", height: 12 }} /></span></div>)}</div>
          : library.error && !library.items.length ? <section className="card"><div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}><b>Không tải được kho cộng đồng</b><span className="muted">{library.error}</span><button type="button" className="btn btn-sm" onClick={() => void library.load()}>Thử lại</button></div></section>
          : !visible.length ? <section className="card"><div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}><b>{filtered ? "Không tìm thấy mô phỏng phù hợp" : "Chưa có mô phỏng nào"}</b>
            <span className="muted">{filtered ? "Thử từ khóa khác hoặc bỏ bớt bộ lọc." : "Mô phỏng giáo viên chia sẻ và đã được duyệt sẽ xuất hiện ở đây."}</span>{filtered && <button type="button" className="btn btn-sm" onClick={reset}>Xóa bộ lọc</button>}</div></section>
          : <div className="res">{visible.map(item => {
            const path = paths.get(item.lessonId);
            return <button key={item.id} type="button" className="card rcard" aria-label={"Xem " + item.title} onClick={event => { returnFocus.current = event.currentTarget; void library.open(item); }}>
              <span className="thumb"><SimulationThumb simulationId={item.simulationId} /></span>
              <span className="card-b">
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}><b className="clamp-2" style={{ fontWeight: 500 }} title={item.title}>{item.title}</b>{item.moderationStatus === "FEATURED" && <span className="badge b-brand">Nổi bật</span>}</span>
                <small className="muted clamp-1" style={{ fontSize: 13 }}>{[path?.module ?? item.topic, path?.grade].filter(Boolean).join(" · ") || "Mô phỏng vật lý"}</small>
                <small className="muted clamp-1" style={{ fontSize: 12 }}>{item.sharedByName || "Giáo viên"} · {item.visibility === "PUBLIC" ? item.schoolName || "PhysLive" : "Trong trường"}</small>
              </span>
            </button>;
          })}</div>}
      </div>
    </div>
    <ResourceViewerDialog selectedItem={library.selectedItem} grade={selectedPath?.grade} simulation={library.simulation} generated={library.generated} time={library.time}
      simulationLoading={library.simulationLoading} simulationError={library.simulationError} frame={library.frame} playing={library.playing} canClone returnFocus={returnFocus}
      vectors={{ grid: true, trajectory: true, velocity: true, acceleration: false }} onClose={library.close} onTogglePlaying={library.togglePlaying} onReset={library.reset}
      onFrameChange={library.seek} onTimeChange={library.updateTime} onPlaybackEnd={library.stop} />
  </main>;
}
