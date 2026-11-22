import { useId } from "react";
import "./analytics-surfaces.css";
export type ChartDatum = { label: string; value: number | null | undefined };
const number = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
export default function ReportChart({ title, description, items, variant = "bars", unit = "", max }: Readonly<{ title: string; description: string; items: ChartDatum[]; variant?: "bars" | "donut"; unit?: string; max?: number }>) {
  const id = useId();
  const rows = items.filter((item): item is { label: string; value: number } => item.value != null && Number.isFinite(item.value) && item.value >= 0);
  const total = rows.reduce((sum, item) => sum + item.value, 0);
  const ceiling = max ?? Math.max(1, ...rows.map(item => item.value));
  const segments = rows.map((item, index) => { const start = rows.slice(0, index).reduce((sum, row) => sum + row.value, 0) * 100 / Math.max(total, 1); return "var(--chart-" + (index % 4 + 1) + ") " + start + "% " + (start + item.value * 100 / Math.max(total, 1)) + "%"; }).join(",");
  return <section className="report-chart" aria-labelledby={id}><header><h2 id={id}>{title}</h2><p>{description}</p></header>
    {!rows.length ? <p className="report-chart-empty">Chưa có dữ liệu để hiển thị.</p> : variant === "donut" ? <div className="report-chart-distribution"><div className="report-chart-donut" role="img" aria-label={rows.map(item => item.label + ": " + number(item.value)).join("; ")} style={{ background: total ? "conic-gradient(" + segments + ")" : "var(--line)" }}><span><strong>{number(total)}</strong><small>{unit || "Tổng cộng"}</small></span></div><ul>{rows.map((item, i) => <li key={item.label}><i style={{ background: "var(--chart-" + (i % 4 + 1) + ")" }} /><span>{item.label}</span><strong>{number(item.value)}</strong></li>)}</ul></div> : <div className="report-chart-bars">{rows.map((item, i) => <div className="report-chart-row" key={item.label} tabIndex={0} title={item.label + ": " + number(item.value) + (unit ? " " + unit : "")}><div><span>{item.label}</span><strong>{number(item.value)}{unit && " " + unit}</strong></div><div className="report-chart-track"><span style={{ width: Math.min(100, item.value / ceiling * 100) + "%", background: "var(--chart-" + (i % 4 + 1) + ")" }} /></div></div>)}</div>}
  </section>;
}
