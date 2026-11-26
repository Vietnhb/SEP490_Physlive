import { BarChartIcon, CheckIcon, ClockIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import s from "../pages/SchoolUnlockRequests.module.css";
export type SchoolAppealStatistics = {
  pending: number; oldestPendingDays: number | null; approved30Days: number; rejected30Days: number;
  averageResolutionDays: number | null; months: { month: string; count: number }[];
};
const fmt = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
export function UnlockStatistics({ data, loading }: { data?: SchoolAppealStatistics; loading: boolean }) {
  const cards = [
    { label: "Chờ xử lý", value: data ? fmt(data.pending) : "—", detail: data?.oldestPendingDays != null ? data.oldestPendingDays < 1 ? "Cũ nhất: trong hôm nay" : `Cũ nhất ${fmt(data.oldestPendingDays)} ngày` : "Không có đơn đang chờ", icon: <ClockIcon /> },
    { label: "Đã duyệt mở khóa", value: data ? fmt(data.approved30Days) : "—", detail: "Đã xử lý trong 30 ngày qua", icon: <CheckIcon /> },
    { label: "Đã từ chối", value: data ? fmt(data.rejected30Days) : "—", detail: "Đã xử lý trong 30 ngày qua", icon: <ExclamationTriangleIcon /> },
    { label: "Xử lý trung bình", value: data?.averageResolutionDays != null ? `${fmt(data.averageResolutionDays)} ngày` : "—", detail: data?.averageResolutionDays != null ? "Từ lúc gửi đến lúc xử lý · 30 ngày" : "Chưa có đơn được xử lý trong 30 ngày", icon: <BarChartIcon /> },
  ];
  return <section className={s.statistics} aria-label="Thống kê yêu cầu mở khóa toàn trường" aria-busy={loading}>{cards.map(card => <article className={s.statCard} key={card.label}><span className={s.statIcon}>{card.icon}</span><span>{card.label}</span><strong>{card.value}</strong><small>{!data ? loading ? "Đang tải số liệu…" : "Chưa tải được số liệu" : card.detail}</small></article>)}</section>;
}
export function UnlockMonthlyChart({ data, loading }: { data?: SchoolAppealStatistics; loading: boolean }) {
  const max = Math.max(1, ...(data?.months.map(item => item.count) ?? []));
  return <section className={s.monthlyCard}><div className={s.chartHeading}><h2>Yêu cầu theo tháng</h2><span>6 tháng gần nhất</span></div><p>Số đơn đã gửi · toàn trường</p>{data ? <>
    <div className={s.monthBars} role="img" aria-label={data.months.map(item => `Tháng ${item.month.slice(5,7)}/${item.month.slice(0,4)}: ${item.count} yêu cầu`).join("; ")}>{data.months.map((item,index) => <div className={s.monthColumn} key={item.month} title={`Tháng ${item.month.slice(5,7)}/${item.month.slice(0,4)}: ${fmt(item.count)} yêu cầu`}><span>{fmt(item.count)}</span><div className={s.monthBar} data-current={index === data.months.length - 1} style={{ height: `${item.count / max * 100}px` }} /><small>T{Number(item.month.slice(5,7))}</small></div>)}</div>
    {data.months.every(item => item.count === 0) && <p className={s.chartEmpty}>Chưa có yêu cầu trong 6 tháng gần nhất.</p>}
  </> : <p className={s.chartEmpty}>{loading ? "Đang tải biểu đồ…" : "Chưa tải được số liệu."}</p>}</section>;
}
