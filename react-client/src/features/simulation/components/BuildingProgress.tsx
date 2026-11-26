import { useEffect, useState } from "react";
import { ThrowIllustration } from "./PhysicsGlyph";

export type BuildPhase = "read" | "analyse" | "build" | "open";

const STEPS: { phase: BuildPhase; label: string; title: string }[] = [
  { phase: "read", label: "Đọc đề bài", title: "Đang đọc đề bài…" },
  { phase: "analyse", label: "Phân tích dữ kiện", title: "Đang phân tích dữ kiện…" },
  { phase: "build", label: "Dựng mô phỏng và đối chiếu định luật", title: "Đang dựng mô phỏng… (có thể mất 1–3 phút)" },
];
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * What the stage shows while the server works on a description — the canvas "đang dựng" frame: the empty stage with a
 * card that says which step is running, how long it has taken, and what is already done. Nothing is left blank.
 */
export default function BuildingProgress({ phase }: Readonly<{ phase: BuildPhase }>) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  // opening a saved simulation is one step of its own, not the three of a new description
  const steps = phase === "open" ? [{ phase, label: "Tải mô phỏng, thông số và kết quả kiểm tra", title: "Đang mở mô phỏng đã lưu…" }] : STEPS;
  const current = steps.findIndex(step => step.phase === phase);
  return <div className="simulation-stage-empty is-building" role="status" aria-live="polite" aria-busy="true">
    <div className="building-card">
      <div className="building-card__head">
        <b>{steps[current].title}</b>
        <span className="building-card__clock" aria-label={`Đã chạy ${clock(Math.floor((now - started) / 1000))}`}>{clock(Math.floor((now - started) / 1000))}</span>
      </div>
      <div className="building-card__art"><ThrowIllustration /></div>
      <ol className="building-card__steps">{steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "active" : "todo";
        return <li key={step.phase} className={"is-" + state}>
          <span className="building-card__mark" aria-hidden="true">{state === "done" ? "✓" : state === "active" ? <span className="building-card__spinner" /> : index + 1}</span>
          <span>{step.label}</span>
          <small>{state === "done" ? "xong" : state === "active" ? "đang chạy" : ""}</small>
        </li>;
      })}</ol>
    </div>
  </div>;
}

/** The inspector while nothing is built yet but work is running: the shape of the readings to come, not an empty column. */
export function InspectorSkeleton() {
  return <div className="inspector-skeleton" aria-hidden="true">
    {[["38%", "18%"], ["52%", "14%"], ["44%", "20%"]].map(([label, value], index) => <div key={index} className="inspector-skeleton__row">
      <span className="sk-line" style={{ width: label }} /><span className="sk-line" style={{ width: value }} />
      <span className="sk-line sk-track" />
    </div>)}
    <span className="sk-line" style={{ width: "34%", height: 12, marginTop: 8 }} />
    <span className="sk-line" style={{ width: "100%", height: 64, borderRadius: 12 }} />
    <p>Thông số và kết quả kiểm tra sẽ hiện ở đây khi mô phỏng dựng xong.</p>
  </div>;
}
