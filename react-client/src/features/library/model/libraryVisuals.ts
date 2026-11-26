import type { LibraryItem } from "../../../shared/types/physlive";

/** The canvas's simulation pictures, chosen by the topic of the saved simulation. */
export const picture = (topic = "") => {
  const t = topic.toUpperCase();
  if (/OSCILLATION|WAVE|SOLID_DEFORMATION/.test(t)) return t.includes("SOLID") ? "/studio/spring-teal.svg" : "/studio/pendulum-teal.svg";
  if (/ELECTRIC|CURRENT|ELECTRONIC|MAGNETIC|RADIO/.test(t)) return "/studio/circuit-teal.svg";
  return "/studio/projectile-teal.svg";
};
export const verification = (item: LibraryItem) => item.validationStatus === "FLAGGED"
  ? { label: "Cần kiểm tra lại", tone: "b-warn", hint: "Có kết quả chưa khớp định luật (vẫn dùng và giao bài được)" }
  : { label: "Đã đạt", tone: "b-success", hint: "Đã đối chiếu với định luật của chương trình" };
