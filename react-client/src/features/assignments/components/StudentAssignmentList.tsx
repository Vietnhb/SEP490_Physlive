import s from "./StudentAssignmentList.module.css";
import { StudentAssignmentsArt } from "./StudentAssignmentsArt";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { compareStudentWork, studentAssignmentState, studentAssignmentSummary } from "../model/studentAssignmentState";
import { missedDeadline } from "../model/assignmentDeadline";
import { useState } from "react";
import { Badge, Button, Callout, Card, Heading, SegmentedControl, Select, Table, Text, TextField, VisuallyHidden } from "@radix-ui/themes";
import { motion, useReducedMotion } from "motion/react";
import type { Assignment, AssignmentActivityType } from "../../../shared/types/physlive";
import { useAssignmentClock } from "../hooks/useAssignmentClock";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";

type AssignmentListProps = {
  assignments: Assignment[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onSelect: (item: Assignment) => void;
};
type Filter = "todo" | "submitted" | "expired" | "all";
const needsWork = (item: Assignment, now: number) => studentAssignmentState(item, now).actionable;
const activityLabels: Record<AssignmentActivityType, string> = {
  PREDICT_OBSERVE_EXPLAIN: "Dự đoán · Quan sát · Giải thích",
  MEASUREMENT: "Đo lường",
  PARAMETER_INVESTIGATION: "Khảo sát thông số",
  FREE_EXPLORATION: "Khám phá mô phỏng",
};

export function AssignmentList({ assignments, loading, error, onRefresh, onSelect }: Readonly<AssignmentListProps>) {
  const [filter, setFilter] = useState<Filter>("todo");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const reducedMotion = useReducedMotion();
  const now = useAssignmentClock();
  const pending = assignments.filter(item => needsWork(item, now)).length;
  const classes = Array.from(new Map(assignments.filter(item => item.classId).map(item => [item.classId!, item.className || "Lớp học"])).entries());
  const keyword = search.trim().toLocaleLowerCase("vi");
  const visible = assignments.filter(item =>
    (filter === "all" || (filter === "todo" ? needsWork(item, now) : filter === "expired" ? missedDeadline(item, now) : Boolean(item.submissionCompleted && !item.retryAllowed && !missedDeadline(item, now)))) &&
    (!classFilter || item.classId === classFilter) &&
    [item.title, item.className, item.libraryItemTitle].filter(Boolean).join(" ").toLocaleLowerCase("vi").includes(keyword),
  ).sort((a, b) => compareStudentWork(a, b, now));
  const counts: Record<Filter, number> = { todo: pending, submitted: studentAssignmentSummary(assignments, now).submitted, expired: assignments.filter(item => missedDeadline(item, now)).length, all: assignments.length };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const summary = studentAssignmentSummary(assignments, now);
  const graded = assignments.filter(item => item.gradingStatus === "TEACHER_CONFIRMED" && item.submissionCompleted && !item.retryAllowed && item.score != null && Number.isFinite(item.score) && (item.maxScore ?? 10) > 0).sort((a,b) => Date.parse(a.completedAt || a.assignedAt) - Date.parse(b.completedAt || b.assignedAt));
  const average = graded.length ? graded.reduce((sum,item) => sum + item.score! / (item.maxScore ?? 10) * 10, 0) / graded.length : null;
  const datedSubmissions = assignments.filter(item => item.submissionCompleted && !item.retryAllowed && item.dueAt && item.completedAt && Number.isFinite(Date.parse(item.dueAt)) && Number.isFinite(Date.parse(item.completedAt)));
  const onTime = datedSubmissions.filter(item => Date.parse(item.completedAt!) <= Date.parse(item.dueAt!)).length;
  const upcoming = assignments.filter(item => needsWork(item,now) && item.dueAt && Date.parse(item.dueAt) > now && (!classFilter || item.classId === classFilter)).sort((a,b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!)).slice(0,4);
  const format = (value:number) => value.toLocaleString("vi-VN",{maximumFractionDigits:1});
  const show = (value:string|number) => loading || error ? "—" : value;
  const hasSearch = Boolean(keyword || classFilter);
  const emptyTitle = assignments.length === 0 ? "Chưa có bài tập được giao" : hasSearch ? "Không tìm thấy bài tập phù hợp" : filter === "todo" ? "Không có bài tập cần làm" : filter === "expired" ? "Không có bài tập bị quá hạn" : "Chưa có bài tập đã nộp";
  const emptyDescription = assignments.length === 0 ? "Bài tập của giáo viên sẽ xuất hiện tại đây." : hasSearch ? "Thử đổi từ khóa hoặc bộ lọc lớp học." : filter === "todo" ? "Xem tất cả bài tập để theo dõi kết quả, điểm số và các bài đã hết hạn." : "Bài tập sau khi nộp sẽ xuất hiện trong mục này.";

  return <section className={s.page}>
    <header className={s.header}><div><h1>Bài tập được giao</h1><p>Theo dõi hạn nộp, hoàn thành bài thực hành và xem kết quả của bạn.</p></div><StudentAssignmentsArt /></header>
    <div className={s.stats} aria-label="Thống kê bài tập">
      <article><span className={s.icon}><LearningIcon name="edit" /></span><span>Cần làm</span><strong>{show(pending)}</strong><small>{show(assignments.filter(item => item.retryAllowed && needsWork(item,now)).length)} bài cần làm lại</small></article>
      <article><span className={s.icon}><LearningIcon name="check" /></span><span>Đã nộp</span><strong>{show(summary.submitted)}</strong><small>{show(graded.length)} bài đã chấm chính thức</small></article>
      <article><span className={s.icon}><LearningIcon name="chart" /></span><span>Điểm trung bình</span><strong>{show(average == null ? "—" : format(average))}</strong><small>Thang 10 · chỉ tính điểm đã xác nhận</small>{graded.length > 1 && <svg viewBox="0 0 200 30" className={s.spark} aria-hidden="true"><polyline points={graded.slice(-6).map((item,i,all) => (i*200/(all.length-1))+","+(28-item.score!/(item.maxScore??10)*25)).join(" ")} fill="none" stroke="var(--teal-9)" strokeWidth="2" /></svg>}</article>
      <article><span className={s.icon}><LearningIcon name="check" /></span><span>Nộp đúng hạn</span><strong>{show(datedSubmissions.length ? Math.round(onTime/datedSubmissions.length*100)+"%" : "—")}</strong><small>{show(onTime)} / {show(datedSubmissions.length)} bài đã nộp có hạn nộp</small></article>
    </div>
    <div className={s.layout}><div className={s.main}>
    <Card asChild className={"student-assignment-list " + s.list} size="3"><motion.section aria-label="Bài tập được giao" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>
    <div className="student-assignment-toolbar">
      <SegmentedControl.Root value={filter} onValueChange={value => { setFilter(value as Filter); setPage(1); }} size="2" aria-label="Trạng thái bài tập">{([["todo", "Cần làm"], ["submitted", "Đã nộp"], ["expired", "Quá hạn"], ["all", "Tất cả"]] as const).map(([value, label]) => <SegmentedControl.Item key={value} value={value}>{label}<span className="student-filter-count">{counts[value]}</span></SegmentedControl.Item>)}</SegmentedControl.Root>
      <div className="student-assignment-search">
        <TextField.Root type="search" size="2" aria-label="Tìm bài tập" placeholder="Tìm bài tập, lớp học…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }}><TextField.Slot><LearningIcon name="search" /></TextField.Slot></TextField.Root>
        {classes.length > 0 && <Select.Root value={classFilter || "all"} onValueChange={value => { setClassFilter(value === "all" ? "" : value); setPage(1); }}><Select.Trigger aria-label="Lọc theo lớp học" /><Select.Content><Select.Item value="all">Tất cả lớp</Select.Item>{classes.map(([id, label]) => <Select.Item key={id} value={id}>{label}</Select.Item>)}</Select.Content></Select.Root>}
        <RefreshButton disabled={loading} onClick={onRefresh} />
      </div>
    </div>
    {error && <Callout.Root color="red" size="1" className="student-inline-alert"><Callout.Text>{error}</Callout.Text><Button type="button" variant="ghost" color="red" onClick={onRefresh}>Thử lại</Button></Callout.Root>}
    {loading ? <TableLoadingSkeleton label="Đang tải bài tập…" headers={["Bài tập", "Hạn nộp", "Trạng thái", "Thao tác"]} /> : !error && visible.length === 0 ? <div className="student-list-state"><span className="student-empty-icon"><LearningIcon name="book" /></span><Heading as="h3" size="4">{emptyTitle}</Heading><Text as="p" color="gray">{emptyDescription}</Text>{assignments.length > 0 && <Button type="button" variant="soft" onClick={() => { setFilter("all"); setSearch(""); setClassFilter(""); }}>Xem tất cả</Button>}</div> : (!error || assignments.length > 0) && <Table.Root className="student-assignment-table" variant="ghost" size="2"><Table.Header><Table.Row><Table.ColumnHeaderCell>Bài tập</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Hạn nộp</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell><Table.ColumnHeaderCell><VisuallyHidden>Thao tác</VisuallyHidden></Table.ColumnHeaderCell></Table.Row></Table.Header><Table.Body>{pageItems.map(item => {
      const missed = missedDeadline(item, now);
      const { label: status, color, action } = studentAssignmentState(item, now);
      const activityType = typeof item.questions === "object" && item.questions ? item.questions.activityType || "PREDICT_OBSERVE_EXPLAIN" : "PREDICT_OBSERVE_EXPLAIN";
      return <Table.Row key={item.id}>
        <Table.Cell className="student-assignment-title"><Heading as="h3" size="3" title={item.title}>{item.title}</Heading><Text as="p" color="gray" size="2">{item.className && <>{item.className}<span aria-hidden="true"> · </span></>}{activityLabels[activityType]}</Text>{item.feedback && <details className="student-assignment-feedback"><summary>Nhận xét của giáo viên</summary><p>{item.feedback}</p></details>}</Table.Cell>
        <Table.Cell className="student-assignment-deadline">{item.dueAt ? <><Text asChild size="2"><time dateTime={item.dueAt}>{new Date(item.dueAt).toLocaleDateString("vi-VN")}</time></Text><Text as="div" color="gray" size="1">{new Date(item.dueAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</Text></> : <Text color="gray" size="2">Không giới hạn</Text>}</Table.Cell>
        <Table.Cell><Badge color={color} size="2">{status}</Badge>{(missed || item.score != null) && !item.retryAllowed && <Text as="div" className="student-assignment-score" size="1" color="gray">{missed ? 0 : item.score}/{item.maxScore ?? 10}{item.gradingStatus === "AI_GRADED" ? " · Tạm tính" : ""}</Text>}</Table.Cell>
        <Table.Cell className="student-assignment-action"><Button type="button" variant={item.submissionCompleted && !item.retryAllowed ? "soft" : "solid"} onClick={() => onSelect(item)} aria-label={`${action}: ${item.title}`}>{action}<LearningIcon name="arrow" /></Button></Table.Cell>
      </Table.Row>;
    })}</Table.Body></Table.Root>}
    {!loading && !error && visible.length > 0 && <footer className={s.pagination}><span>Hiển thị {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,visible.length)} / {visible.length} bài tập</span><div><label>Số dòng <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}>{[5,10,20,50].map(size => <option key={size} value={size}>{size}</option>)}</select></label><Button variant="outline" size="1" disabled={currentPage===1} onClick={() => setPage(currentPage-1)}>Trước</Button><span>{currentPage}/{pageCount}</span><Button variant="outline" size="1" disabled={currentPage===pageCount} onClick={() => setPage(currentPage+1)}>Sau</Button></div></footer>}
  </motion.section></Card>
  </div><aside className={s.aside}>
    <section className={s.sideCard}><h2>Hạn nộp sắp tới</h2><p className={s.hint}>Các bài còn hạn{classFilter ? " trong lớp đang chọn" : ""}</p>{loading ? <p role="status" className={s.empty}>Đang tải…</p> : error ? <p className={s.empty}>Chưa tải được hạn nộp.</p> : !upcoming.length ? <p className={s.empty}>Không có bài tập sắp đến hạn.</p> : <ul className={s.deadlines}>{upcoming.map(item => {const hours=Math.ceil((Date.parse(item.dueAt!)-now)/3600000);return <li key={item.id}><span className={s.day}>{new Date(item.dueAt!).getDate()}</span><button type="button" title={item.title} onClick={() => onSelect(item)}><strong>{item.title}</strong><small>{new Date(item.dueAt!).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})} · {item.className}</small></button><Badge color={hours<=24?"amber":"blue"}>Còn {hours<=24 ? hours+" giờ" : Math.ceil(hours/24)+" ngày"}</Badge></li>;})}</ul>}</section>
    <section className={s.sideCard}><div className={s.sideHeading}><h2>Điểm theo hình thức bài</h2><span>Thang 10</span></div><p className={s.hint}>Trung bình điểm đã xác nhận</p>{loading ? <p role="status" className={s.empty}>Đang tải…</p> : error ? <p className={s.empty}>Chưa tải được điểm.</p> : !graded.length ? <p className={s.empty}>Chưa có bài được chấm chính thức.</p> : Object.entries(activityLabels).map(([type,label],index) => {const items=graded.filter(item => (typeof item.questions === "object" ? item.questions?.activityType || "PREDICT_OBSERVE_EXPLAIN" : "PREDICT_OBSERVE_EXPLAIN")===type);if(!items.length)return null;const value=items.reduce((sum,item)=>sum+item.score!/(item.maxScore??10)*10,0)/items.length;return <div className={s.scoreBar} key={type}><div><span>{label}</span><strong>{format(value)}</strong></div><div className={s.track}><span style={{width:Math.max(0,Math.min(100,value*10))+"%",background:index%2?"#6d8fc9":"#23919a"}} /></div><small>{items.length} bài đã chấm</small></div>;})}</section>
  </aside></div></section>;
}
