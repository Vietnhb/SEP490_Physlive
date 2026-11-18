import type { SolverTimeline } from "../model/svgScene";
import { saveFile } from "../../../shared/lib/saveFile";

export function timelineCsv(timeline: SolverTimeline): string {
  const keys = [...new Set(timeline.frames.flatMap(frame => Object.keys(frame.values)))];
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  return ["time_seconds," + keys.map(cell).join(","), ...timeline.frames.map(frame =>
    [frame.t, ...keys.map(key => frame.values[key] ?? "")].map(cell).join(","))].join("\r\n");
}

export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

export function downloadFile(name: string, content: string, type: string) {
  saveFile(name, new Blob([content], { type }));
}
