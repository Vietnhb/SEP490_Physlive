import RefreshButton from "../../../shared/ui/RefreshButton";
import LearningIcon from "../../../shared/ui/LearningIcon";
import ReportChart from "../../../shared/ui/ReportChart";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Select, Tooltip } from "@radix-ui/themes";
import { useResource } from "../../../shared/hooks/operationsData";
import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import type { TeacherClassOption } from "../../../shared/types/physlive";
import { apiMessage } from "../../../shared/lib/apiError";
import { classReportUrl, downloadClassReport, type ClassReport, type ClassReportFilters } from "../api/classReportApi";
import styles from "./TeacherClassReport.module.css";
const defaults:ClassReportFilters = {query:"",status:"ALL",from:"",to:""};
const number = (value:number|null|undefined) => value == null ? "—" : value.toLocaleString("vi-VN",{maximumFractionDigits:2});
const date = (value:string|null) => value ? new Date(value).toLocaleDateString("vi-VN") : "Không giới hạn";
export default function TeacherClassReport() {
  const classes = useResource<TeacherClassOption[]>("/assignments/mine/teacher/classes");
  const [params,setParams] = useSearchParams();
  const chosen = params.get("classId");
  const classId = chosen ?? classes.data?.[0]?.id ?? "";
  const permitted = classes.data?.some(item=>item.id===classId) ?? false;
  const controls = <div className={styles.classPicker}><label htmlFor="report-class">Lớp báo cáo</label><Select.Root value={classId || undefined} onValueChange={id=>setParams({classId:id})}><Select.Trigger id="report-class" placeholder="Chọn lớp phụ trách"/><Select.Content position="popper">{classes.data?.map(item=><Select.Item key={item.id} value={item.id}>{item.name} · {item.schoolYear}</Select.Item>)}</Select.Content></Select.Root></div>;
  return <main className={"lab-main "+styles.page} data-analytics="report" data-report-design="teacher">


    {(!permitted || classes.loading || classes.error) && controls}
    {classes.loading ? <TableLoadingSkeleton headers={["Bài tập","Đã nộp","Điểm trung bình"]}/> : classes.error ? <div role="alert" className={styles.error}>{classes.error}<Button variant="outline" onClick={()=>void classes.refresh()}>Thử lại</Button></div> : !classes.data?.length ? <p className={styles.empty}>Bạn chưa được phân công lớp để xem báo cáo.</p> : !permitted ? <p role="alert" className={styles.error}>Lớp không thuộc danh sách đang phụ trách. Hãy chọn một lớp khác.</p> : <Report key={classId} classId={classId} controls={controls}/>}
  </main>;
}
function Report({classId,controls}:{classId:string;controls: import("react").ReactNode}) {
  const [draft,setDraft] = useState(defaults), [filters,setFilters] = useState(defaults);
  const [page,setPage] = useState(0), [size,setSize] = useState(10);
  const [error,setError] = useState(""), [notice,setNotice] = useState("");
  const [exporting,setExporting] = useState(false); const exportLock = useRef(false);
  const report = useResource<ClassReport>(classReportUrl(classId,filters,page,size));
  const data = report.data, summary = data?.summary;
  const submit = (event:React.FormEvent) => { event.preventDefault();setNotice(""); if(draft.from && draft.to && draft.from>draft.to) {setError("Từ ngày phải trước hoặc bằng đến ngày.");return;}setError("");setPage(0);setFilters({...draft,query:draft.query.trim()}); };
  const clear = () => {setDraft(defaults);setFilters(defaults);setPage(0);setError("");setNotice("");};
  const exportCsv = async () => { if(exportLock.current)return;exportLock.current=true;setExporting(true);setError("");setNotice("");try {await downloadClassReport(classId,filters);setNotice("Đã xuất CSV toàn bộ bài tập theo bộ lọc đang áp dụng.");}catch(cause){setError(apiMessage(cause,"Không thể xuất báo cáo. Vui lòng thử lại."));}finally{exportLock.current=false;setExporting(false);} };
  const stats = [
    {label:"Bài tập",value:summary?.assignments,hint:"Theo bộ lọc ngày giao bài"},
    {label:"Lượt nộp / lượt giao",value:summary ? number(summary.submitted)+" / "+number(summary.recipients) : undefined,hint:summary?.submissionRate==null ? "Chưa có lượt giao" : number(summary.submissionRate)+"% đã nộp"},
    {label:"Bài nộp chờ chấm",value:summary?.awaitingGrade,hint:"Gồm điểm chưa được xác nhận"},
    {label:"Điểm trung bình /10",value:summary?.average10,hint:"Điểm chính thức và 0 do quá hạn"},
  ];
  return <>
    <section data-kpis className={styles.stats} aria-label="Tổng hợp kết quả">{stats.map(item=><div data-kpi key={item.label}><span>{item.label}</span><strong>{report.error ? "—" : report.loading ? "…" : typeof item.value === "string" ? item.value : number(item.value)}</strong><small>{item.hint}</small></div>)}</section>
    <form className={styles.filters} onSubmit={submit} aria-label="Bộ lọc báo cáo lớp">
      {controls}
      <label>Tìm bài tập<input type="search" maxLength={160} placeholder="Tên bài tập…" value={draft.query} onChange={e=>setDraft({...draft,query:e.target.value})}/></label>
      <label>Từ ngày giao<input type="date" min="1900-01-01" max="9998-12-31" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></label>
      <label>Đến ngày giao<input type="date" min="1900-01-01" max="9998-12-31" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/></label>
      <label>Trạng thái<Select.Root value={draft.status} onValueChange={status=>setDraft({...draft,status})}><Select.Trigger aria-label="Trạng thái bài tập"/><Select.Content position="popper"><Select.Item value="ALL">Tất cả</Select.Item><Select.Item value="ACTIVE">Đang mở</Select.Item><Select.Item value="CLOSED">Đã đóng</Select.Item></Select.Content></Select.Root></label>
      <Button type="submit">Áp dụng</Button><Button type="button" variant="soft" onClick={clear}>Xóa bộ lọc</Button>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.success}>{notice}</p>}

    {summary && !report.error && !report.loading && <div className={styles.analysis}><ReportChart title="Tình hình nộp bài" description="Toàn bộ lượt giao theo bộ lọc." variant="donut" unit="lượt giao" items={[{label:"Đã nộp",value:summary.submitted},{label:"Chưa nộp",value:summary.notSubmitted}]}/><ReportChart title="Điểm trung bình từng bài" description="Tối đa 8 bài trên trang hiện tại · Điểm chính thức, thang 10." unit="/10" max={10} items={data?.items.slice(0,8).map(item=>({label:item.title,value:item.average10})) ?? []}/></div>}
    <section data-panel className={styles.panel} aria-label="Danh sách kết quả bài tập">
      <header className={styles.toolbar}><div><h2>Kết quả bài tập{data?.className ? " · "+data.className : ""}</h2>{data && <small>Năm học {data.schoolYear} · Cập nhật {new Date(data.asOf).toLocaleString("vi-VN")}</small>}</div><div><RefreshButton onClick={()=>void report.refresh()} disabled={report.refreshing} /><Button variant="soft" onClick={()=>void exportCsv()} disabled={exporting || report.loading || Boolean(report.error) || !data?.totalElements}><LearningIcon name="download" />{exporting ? "Đang xuất…" : "Xuất CSV"}</Button></div></header>
      <div className={styles.tableContext}><span>{data?.totalElements ?? 0} bài tập phù hợp bộ lọc</span><Tooltip content="Gồm học sinh đã rời lớp. Chưa nộp gồm bài trả làm lại và quá hạn không nộp. Điểm TB quy về thang 10, không tính điểm tạm tính."><button type="button" aria-label="Cách tính số liệu báo cáo"><LearningIcon name="bulb" />Cách tính số liệu</button></Tooltip></div>
      {report.error ? <div role="alert" className={styles.error}>{report.error}<Button variant="outline" onClick={()=>void report.refresh()}>Thử lại</Button></div> : report.loading ? <TableLoadingSkeleton headers={["Bài tập","Được giao","Đã nộp","Chưa nộp","Chờ chấm","Điểm TB"]}/> : !data?.items.length ? <p className={styles.empty}>Không có bài tập phù hợp bộ lọc.</p> : <div className={styles.scroll} role="region" aria-label="Bảng kết quả bài tập" tabIndex={0} aria-busy={report.refreshing}><table className={styles.table}><thead><tr><th>Bài tập</th><th>Được giao</th><th>Đã nộp</th><th>Chưa nộp</th><th>Nộp trễ</th><th>Chờ chấm</th><th>Đã chấm</th><th>Quá hạn 0đ</th><th>TB /10</th><th>Chi tiết</th></tr></thead><tbody>{data.items.map(item=><tr key={item.id}><td><Tooltip content={item.title}><span className={styles.title} tabIndex={0}>{item.title}</span></Tooltip><small>{item.assignedBy} · Giao {date(item.assignedAt)}</small><small>Hạn {date(item.dueAt)} <Badge color={item.status==="ACTIVE"?"green":"gray"}>{item.status==="ACTIVE"?"Đang mở":"Đã đóng"}</Badge></small></td><td>{number(item.recipients)}</td><td><span className={item.submitted ? styles.submitted : styles.zero}>{number(item.submitted)}</span></td><td>{number(item.notSubmitted)}</td><td><span className={item.late ? styles.late : styles.zero}>{number(item.late)}</span></td><td><span className={item.awaitingGrade ? styles.pending : styles.zero}>{number(item.awaitingGrade)}</span></td><td>{number(item.confirmed)}</td><td><span className={item.missedDeadline ? styles.missed : styles.zero}>{number(item.missedDeadline)}</span></td><td><strong>{number(item.average10)}</strong></td><td><Button asChild variant="soft" size="1"><Link to={"/lab/classes/"+classId+"?tab=assignments&assignment="+encodeURIComponent(item.id)}>Xem bài</Link></Button></td></tr>)}</tbody></table></div>}
      {data && !report.error && <footer className={styles.footer}><span>{data.totalElements ? "Hiển thị "+(data.page*data.size+1)+"–"+Math.min((data.page+1)*data.size,data.totalElements)+" / "+data.totalElements+" bài tập" : "0 bài tập"}</span><div><label>Số bài/trang<Select.Root value={String(size)} onValueChange={value=>{setSize(Number(value));setPage(0);}}><Select.Trigger aria-label="Số bài mỗi trang"/><Select.Content position="popper">{[5,10,20,50].map(value=><Select.Item value={String(value)} key={value}>{value}</Select.Item>)}</Select.Content></Select.Root></label><Button size="1" variant="soft" disabled={data.page===0 || report.refreshing} onClick={()=>setPage(data.page-1)}>Trước</Button><span>Trang {data.page+1}/{data.totalPages}</span><Button size="1" variant="soft" disabled={data.page+1>=data.totalPages || report.refreshing} onClick={()=>setPage(data.page+1)}>Sau</Button></div></footer>}
    </section>
  </>;
}
