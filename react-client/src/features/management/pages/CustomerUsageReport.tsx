import PageActions from "../../../shared/layout/PageActions";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Dialog, Select, Tooltip } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { apiMessage } from "../../../shared/lib/apiError";
import { saveFile } from "../../../shared/lib/saveFile";
import { useResource } from "../../../shared/hooks/operationsData";
import LearningIcon from "../../../shared/ui/LearningIcon";
import type { CustomerUsageReport as Report, UsageMetric, UsagePoint, UsageSchool } from "../api/customerUsageApi";
import s from "./CustomerUsageReport.module.css";

const numbers = (value: number) => value.toLocaleString("vi-VN");
const compact = (value: number) => new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const metricLabels: Record<UsageMetric, string> = { aiCalls: "Lượt dùng AI", activeUsers: "Người dùng hoạt động", assignments: "Bài đã giao", submissions: "Bài đã nộp", tokens: "Token AI", revenue: "Doanh thu" };
const care: Record<string, { label: string; color: string }> = {
  EXPIRING: { label: "Sắp hết hạn gói", color: "#ac6526" }, QUOTA: { label: "Gần hết hạn mức AI", color: "#7661ad" },
  IDLE: { label: "Ít hoạt động", color: "#b54a45" }, UNKNOWN: { label: "Chưa ghi nhận sử dụng", color: "#7b8495" },
  NONE: { label: "Đang theo dõi", color: "#3e8275" },
};
const localYear = () => Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date()));
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa ghi nhận";
const valueText = (value: number, metric: UsageMetric) => numbers(value) + (metric === "revenue" ? " ₫" : "");
const periodText = (year: number, month: string | number | null) => month ? "Tháng " + month + "/" + year : "Năm " + year;
function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return <label className={s.field}><span>{label}</span><Select.Root value={value} onValueChange={onChange}><Select.Trigger aria-label={label} /><Select.Content position="popper">{options.map(([key, text]) => <Select.Item key={key} value={key}>{text}</Select.Item>)}</Select.Content></Select.Root></label>;
}
function Trend({ points, metric, asOf }: { points: UsagePoint[]; metric: "aiCalls" | "activeUsers" | "revenue"; asOf: string }) {
  const id = useId().replaceAll(":", "");
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(...points.map(point => point[metric]), 1);
  const width = 600, height = 240, left = 48, right = 20, top = 20, bottom = 36;
  const x = (i: number) => left + i * (width - left - right) / Math.max(1, points.length - 1);
  const y = (v: number) => top + (height - top - bottom) * (1 - v / max);
  const cutoff = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(asOf));
  const recorded = points.map((p, i) => ({ ...p, i })).filter(p => p.label <= cutoff.slice(0, p.label.length));
  const path = recorded.map(p => x(p.i) + "," + y(p[metric])).join(" ");
  const active = selected == null ? null : points[selected];
  const label = (p: UsagePoint) => p.label.length === 7 ? "Tháng " + Number(p.label.slice(-2)) : "Ngày " + Number(p.label.slice(-2));
  return <div className={s.chart}><div className={s.chartReadout} role="status">{active ? <><span>{label(active)}</span><strong>{valueText(active[metric], metric)}</strong></> : <span>Di chuột hoặc chọn điểm để xem số liệu</span>}</div>
    <svg viewBox={"0 0 " + width + " " + height} role="img" aria-label={"Xu hướng " + metricLabels[metric].toLowerCase()}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".20" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1={left} x2={width - right} y1={y(max * i / 4)} y2={y(max * i / 4)} className={s.gridLine} /><text x={left - 10} y={y(max * i / 4) + 4} textAnchor="end">{compact(max * i / 4)}</text></g>)}
      {recorded.length > 0 && <><polygon points={x(recorded[0].i) + "," + y(0) + " " + path + " " + x(recorded[recorded.length - 1].i) + "," + y(0)} fill={"url(#" + id + ")"} /><polyline points={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></>}
      {points.map((p, i) => <g key={p.label}>{(i % Math.ceil(points.length / 12) === 0 || i === points.length - 1) && <text x={x(i)} y={height - 10} textAnchor="middle">{p.label.length === 7 ? "T" : ""}{Number(p.label.slice(-2))}</text>}{p.label <= cutoff.slice(0, p.label.length) && <circle cx={x(i)} cy={y(p[metric])} r={selected === i ? 7 : 4} tabIndex={0} aria-label={label(p) + ": " + valueText(p[metric], metric)} onMouseEnter={() => setSelected(i)} onMouseLeave={() => setSelected(null)} onFocus={() => setSelected(i)} onBlur={() => setSelected(null)} className={s.point}><title>{label(p)}: {valueText(p[metric], metric)}</title></circle>}</g>)}
    </svg><div className={s.chartLegend}><span />{metricLabels[metric]}<small>Đơn vị: {metric === "revenue" ? "đồng" : metric === "activeUsers" ? "người / kỳ" : "lượt"}</small></div>
    {!points.some(p => p[metric] > 0) && <p className={s.zeroNote}>Chưa ghi nhận {metricLabels[metric].toLowerCase()} trong kỳ này.</p>}
  </div>;
}
function Skeleton() { return <div className={s.skeleton} role="status" aria-label="Đang tải báo cáo khách hàng"><div className={s.stats}>{[0, 1, 2, 3].map(i => <div key={i} />)}</div><div className={s.chartSkeleton} /><div className={s.tableSkeleton} /></div>; }
function SchoolDetail({ school, year, month }: { school: UsageSchool; year: number; month: string }) {
  const params = new URLSearchParams({ year: String(year), schoolId: school.id }); if (month) params.set("month", month);
  const result = useResource<Report>("/reports/customer-usage?" + params);
  return <><Dialog.Title>{school.name}</Dialog.Title><Dialog.Description>{school.code} · {periodText(year, month)} · Gói hiện tại: {school.plan || "Chưa mua gói"}</Dialog.Description>
    {result.error ? <p role="alert">{result.error}</p> : !result.data ? <Skeleton /> : <><div className={s.detailStats}>{([["Lượt dùng AI", school.aiCalls], ["Bài giao", school.assignments], ["Bài nộp", school.submissions], ["Token AI", school.tokens]] as const).map(([label, value]) => <div key={label}><span>{label}</span><strong>{numbers(value)}</strong></div>)}</div><h3>Diễn biến sử dụng AI</h3><Trend points={result.data.trend} metric="aiCalls" asOf={result.data.asOf} /><div className={s.detailMeta}><span>Doanh thu trong kỳ<strong>{valueText(school.revenue, "revenue")}</strong></span><span>Hoạt động gần nhất<strong>{date(school.lastActivity)}</strong></span><span>Hạn gói hiện tại<strong>{school.licenseEnd ? date(school.licenseEnd) : "Chưa thiết lập"}</strong></span></div></>}
    <div className={s.dialogFooter}><Button variant="soft" asChild><Link to="/manager/schools">Quản lý trường <LearningIcon name="arrow" /></Link></Button><Dialog.Close><Button>Đóng</Button></Dialog.Close></div></>;
}
export default function CustomerUsageReport() {
  const initial = { year: String(localYear()), month: "", plan: "", query: "", attention: "ALL", sort: "aiCalls" as UsageMetric };
  const [draft, setDraft] = useState(initial), [filter, setFilter] = useState(initial), [page, setPage] = useState(0), [size, setSize] = useState(10);
  const [metric, setMetric] = useState<"aiCalls" | "activeUsers" | "revenue">("aiCalls");
  const [detail, setDetail] = useState<UsageSchool | null>(null), [exporting, setExporting] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState(""); const exportLock = useRef(false);
  const params = new URLSearchParams({ ...filter, page: String(page), size: String(size) }); if (!filter.month) params.delete("month");
  const resource = useResource<Report>("/reports/customer-usage?" + params), data = resource.data;
  const period = periodText(Number(filter.year), filter.month);
  const apply = (event: React.FormEvent) => { event.preventDefault(); setFilter({ ...draft, query: draft.query.trim() }); setPage(0); setNotice(""); };
  const chooseAttention = (attention: string) => { setDraft(v => ({ ...v, attention })); setFilter(v => ({ ...v, attention })); setPage(0); };
  const download = async () => { if (exportLock.current) return; exportLock.current = true; setExporting(true); setError(""); setNotice(""); try { const result = await api.get<Blob>("/reports/customer-usage/csv?" + params, { responseType: "blob" }); saveFile("khach-hang-" + filter.year + (filter.month ? "-" + filter.month : "") + ".csv", result.data); setNotice("Đã xuất toàn bộ trường theo bộ lọc hiện tại."); } catch (cause) { setError(apiMessage(cause, "Không xuất được báo cáo.")); } finally { exportLock.current = false; setExporting(false); } };
  const totalCare = data?.attention.reduce((sum, group) => sum + (group.key === "NONE" ? 0 : group.count), 0) ?? 0;
  let gradientStart = 0;
  const donut = data?.attention.filter(g => g.count).map(g => { const start = gradientStart; gradientStart += g.count * 100 / Math.max(data.totalElements, 1); return care[g.key].color + " " + start + "% " + gradientStart + "%"; }).join(",");
  return <main className={s.page} data-analytics="report" data-report-design="usage">
    {!resource.error && (resource.loading || !data ? <Skeleton /> : <> <section data-kpis className={s.stats} aria-label="Tổng hợp sử dụng">{([
      { label: "Trường có hoạt động", value: numbers(data.summary.activeSchools), note: "Trong " + numbers(data.summary.schools) + " trường phù hợp bộ lọc", icon: "book", tone: s.primary },
      { label: "Người dùng hoạt động", value: numbers(data.summary.activeUsers), note: "Có dùng AI, giao hoặc nộp bài", icon: "users", tone: s.green },
      { label: "Lượt dùng AI", value: numbers(data.summary.aiCalls), note: numbers(data.summary.tokens) + " token được ghi nhận", icon: "atom", tone: s.purple },
      { label: "Doanh thu trong kỳ", value: compact(data.summary.revenue) + " ₫", note: "Chỉ giao dịch đã thanh toán", icon: "chart", tone: s.teal },
    ] as const).map(card => <article data-kpi className={s.stat + " " + card.tone} key={card.label}><span className={s.statIcon}><LearningIcon name={card.icon} /></span><span>{card.label}</span><strong title={card.label === "Doanh thu trong kỳ" ? valueText(data.summary.revenue, "revenue") : card.value}>{card.value}</strong><small>{card.note}</small></article>)}</section><div className={s.periodRow}><span className={s.period}><LearningIcon name="activity" />{period}</span><small>Dữ liệu cập nhật {new Date(data.asOf).toLocaleString("vi-VN")}</small></div></>)}
    <RefreshButton disabled={resource.refreshing} onClick={() => void resource.refresh()} />
    <PageActions><Button disabled={exporting || !data?.totalElements || !!resource.error} onClick={() => void download()}><LearningIcon name="download" />{exporting ? "Đang xuất…" : "Xuất CSV"}</Button></PageActions>
    <form className={s.filters} aria-label="Bộ lọc khách hàng" onSubmit={apply}>
      <Choice label="Năm báo cáo" value={draft.year} onChange={year => setDraft({ ...draft, year })} options={Array.from({ length: localYear() - 1999 }, (_, i) => [String(localYear() - i), String(localYear() - i)])} />
      <Choice label="Tháng" value={draft.month || "ALL"} onChange={month => setDraft({ ...draft, month: month === "ALL" ? "" : month })} options={[["ALL", "Cả năm"], ...Array.from({ length: 12 }, (_, i): [string, string] => [String(i + 1), "Tháng " + (i + 1)])]} />
      <Choice label="Gói hiện tại" value={draft.plan || "ALL"} onChange={plan => setDraft({ ...draft, plan: plan === "ALL" ? "" : plan })} options={[["ALL", "Tất cả gói"], ...(data?.plans ?? []).map((p): [string, string] => [p, p])]} />
      <label className={s.field + " " + s.search}><span>Trường học</span><span className={s.searchInput}><LearningIcon name="search" /><input type="search" maxLength={200} placeholder="Tìm tên hoặc mã trường…" value={draft.query} onChange={e => setDraft({ ...draft, query: e.target.value })} /></span></label>
      <Button type="submit">Áp dụng</Button><Button variant="ghost" type="button" onClick={() => { setDraft(initial); setFilter(initial); setPage(0); }}>Đặt lại</Button>
    </form>
    {(error || notice) && <p role={error ? "alert" : "status"} className={error ? s.error : s.notice}>{error || notice}</p>}
    {resource.error ? <section className={s.panel} role="alert"><h2>Chưa tải được báo cáo</h2><p>{resource.error}</p><Button onClick={() => void resource.refresh()}>Thử lại</Button></section> : resource.loading || !data ? null : <>


    <section className={s.charts} data-usage-analysis>
      <article className={s.panel + " " + s.trendPanel} data-usage-trend><header className={s.panelHeading}><div><h2>Nhịp sử dụng theo {filter.month ? "ngày" : "tháng"}</h2><p>{period} · Toàn bộ trường phù hợp bộ lọc</p></div><div className={s.segment} role="group" aria-label="Chỉ số biểu đồ">{(["aiCalls", "activeUsers", "revenue"] as const).map(key => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{key === "aiCalls" ? "Dùng AI" : key === "activeUsers" ? "Người dùng" : "Doanh thu"}</button>)}</div></header><Trend points={data.trend} metric={metric} asOf={data.asOf} /></article>
      <article data-panel className={s.panel} data-usage-care><header className={s.panelHeading}><div><h2>Ưu tiên chăm sóc</h2><p>Trạng thái hiện tại · Chọn nhóm để lọc</p></div></header><div className={s.careContent}><div className={s.donut} style={{ background: donut ? "conic-gradient(" + donut + ")" : "var(--outline)" }} role="img" aria-label={data.attention.map(g => care[g.key].label + ": " + g.count).join(", ")}><div><strong>{totalCare}</strong><span>cần theo dõi</span></div></div><div className={s.careLegend}>{data.attention.map(group => <button key={group.key} type="button" aria-pressed={filter.attention === group.key} onClick={() => chooseAttention(filter.attention === group.key ? "ALL" : group.key)}><i style={{ background: care[group.key].color }} /><span>{care[group.key].label}</span><strong>{numbers(group.count)}</strong></button>)}</div></div></article>
    <article className={s.panel} data-usage-ranking><header className={s.panelHeading}><div><span className={s.eyebrow}>KHÁCH HÀNG NỔI BẬT</span><h2>Top 5 theo {(filter.sort === "aiCalls" ? "lượt dùng AI" : metricLabels[filter.sort].toLowerCase())}</h2><p>{period} · Chọn trường để xem diễn biến chi tiết</p></div><Choice label="Xếp hạng theo" value={filter.sort} onChange={sort => { setDraft(v => ({ ...v, sort: sort as UsageMetric })); setFilter(v => ({ ...v, sort: sort as UsageMetric })); setPage(0); }} options={Object.entries(metricLabels)} /></header>
      {data.ranking.length ? <div className={s.ranking}>{data.ranking.map((row, i) => <button key={row.id} type="button" onClick={() => setDetail(row)}><span className={s.rankIndex}>{i + 1}</span><span className={s.rankBody}><span className={s.rankText}><Tooltip content={row.name}><span>{row.name}</span></Tooltip><strong>{valueText(row[filter.sort], filter.sort)}</strong></span><span className={s.barTrack}><span style={{ width: Math.max(1, row[filter.sort] * 100 / Math.max(data.ranking[0][filter.sort], 1)) + "%" }} /></span></span><LearningIcon name="chevronRight" /></button>)}</div> : <p className={s.empty}>Chưa có số liệu để xếp hạng trong kỳ này.</p>}
    </article></section>
    <section className={s.panel + " " + s.tablePanel}><header className={s.panelHeading}><div><h2>Chi tiết khách hàng</h2><p>{numbers(data.totalElements)} trường · Sắp xếp theo {(filter.sort === "aiCalls" ? "lượt dùng AI" : metricLabels[filter.sort].toLowerCase())} giảm dần</p></div><Choice label="Nhóm chăm sóc" value={filter.attention} onChange={chooseAttention} options={[["ALL", "Tất cả trường"], ...Object.entries(care).map(([key, entry]): [string, string] => [key, entry.label])]} /></header>
      {!data.items.length ? <div className={s.empty}><LearningIcon name="search" /><h3>Không có trường phù hợp</h3><p>Thử đổi từ khóa, gói dịch vụ hoặc nhóm chăm sóc.</p></div> : <div className={s.tableScroll} role="region" aria-label="Danh sách sử dụng khách hàng" tabIndex={0} aria-busy={resource.refreshing}><table><thead><tr><th>Trường học / Gói hiện tại</th><th>Người dùng</th><th>Dùng AI</th><th>Bài giao / nộp</th><th>Token AI</th><th>Doanh thu</th><th>Hoạt động gần nhất</th><th>Chăm sóc hiện tại</th><th><span className={s.srOnly}>Chi tiết</span></th></tr></thead><tbody>{data.items.map(row => <tr key={row.id}><td><Tooltip content={row.name}><button className={s.schoolName} onClick={() => setDetail(row)}>{row.name}</button></Tooltip><small>{row.code} · {row.plan || "Chưa mua gói"}</small></td><td>{numbers(row.activeUsers)}</td><td>{numbers(row.aiCalls)}</td><td>{numbers(row.assignments)} / {numbers(row.submissions)}</td><td>{numbers(row.tokens)}</td><td>{valueText(row.revenue, "revenue")}</td><td>{date(row.lastActivity)}</td><td><span className={s.careBadge} data-tone={row.attention}>{care[row.attention].label}</span></td><td><Button size="1" variant="ghost" aria-label={"Xem " + row.name} onClick={() => setDetail(row)}><LearningIcon name="chevronRight" /></Button></td></tr>)}</tbody></table></div>}
      <footer className={s.footer}><span>{data.totalElements ? "Hiển thị " + (data.page * data.size + 1) + "–" + Math.min((data.page + 1) * data.size, data.totalElements) + " / " + data.totalElements + " trường" : "0 kết quả"}</span><div><Choice label="Số dòng/trang" value={String(size)} onChange={value => { setSize(Number(value)); setPage(0); }} options={[5, 10, 20, 50].map(n => [String(n), String(n)])} /><Button variant="soft" disabled={data.page === 0 || resource.refreshing} onClick={() => setPage(data.page - 1)}>Trước</Button><span>Trang {data.page + 1}/{data.totalPages}</span><Button variant="soft" disabled={data.page + 1 >= data.totalPages || resource.refreshing} onClick={() => setPage(data.page + 1)}>Sau</Button></div></footer>
    </section>
    <details className={s.method}><summary>Cách đọc báo cáo và phạm vi dữ liệu</summary><p>Lượt dùng AI là số bản ghi tiêu thụ AI, không phải mọi lần bấm chạy mô phỏng. Người dùng hoạt động được tính duy nhất từ người dùng AI, giáo viên giao bài và học sinh nộp bài trong kỳ; không tính đăng nhập đơn thuần. Bài nộp là kết quả nộp được lưu hiện tại, không đếm lại từng lần nộp sửa.</p><p>Gói, hạn gói và nhóm chăm sóc phản ánh hiện tại, không phải gói trong năm được chọn. Sắp hết hạn: trong 30 ngày; gần hạn mức: từ 80% token tháng hiện tại; ít hoạt động: lần ghi nhận cuối cách đây hơn 30 ngày. Mỗi trường thuộc một nhóm ưu tiên theo thứ tự trên.</p><p>Doanh thu dùng cùng quy tắc với trang Thanh toán: chỉ tính giao dịch đã thanh toán, theo ngày thanh toán; giao dịch cũ thiếu ngày này dùng ngày tạo giao dịch. Khi lọc trường, gói hiện tại hoặc nhóm chăm sóc, doanh thu chỉ thuộc các trường phù hợp. Chỉ tổng hợp lịch sử còn được lưu. Số 0 nghĩa là không có bản ghi trong kỳ, không khẳng định trường chưa từng sử dụng. {data.firstRecordedAt ? "Bản ghi sớm nhất trong phạm vi lọc: " + date(data.firstRecordedAt) + "." : "Chưa có lịch sử trong phạm vi lọc."} Token, doanh thu và bài tập được gắn theo trường trong bản ghi nghiệp vụ.</p></details>
    <nav className={s.related}><Link to="/manager/payments">Thanh toán & doanh thu <LearningIcon name="arrow" /></Link></nav>
    </>}
    <Dialog.Root open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }}><Dialog.Content maxWidth="860px" className={s.dialog}>{detail && <SchoolDetail key={detail.id} school={detail} year={Number(filter.year)} month={filter.month} />}</Dialog.Content></Dialog.Root>
  </main>;
}
