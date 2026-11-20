import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import Icon from "../../../shared/ui/LearningIcon";
import type { SimulationWorkspaceModel } from "../hooks/useSimulationWorkspace";
import { downloadFile, timelineCsv } from "../engine/exportData";

/** A file name from the simulation's description: lower-case ASCII words, never empty. */
function fileStem(text: unknown) {
  const words = String(text ?? "").normalize("NFD").replaceAll(/[̀-ͯ]/g, "").replaceAll(/[đĐ]/g, "d")
    .toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 6);
  return words.length ? "physlive-" + words.join("-") : "physlive";
}

/**
 * Exports what is on screen: the data as CSV, the whole run as JSON, or a page that replays it offline (and prints to
 * PDF). The workspace has no Radix Theme, so the menu is the unstyled primitive with its own styles.
 */
export default function SimulationExport({ preview }: Readonly<Pick<SimulationWorkspaceModel, "preview">>) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const simulation = preview.simulation, timeline = preview.liveTimeline ?? simulation?.simulationSpec.solverTimeline;
  if (!simulation || !timeline) return null;
  const snapshot = { ...simulation, presentation: preview.presentation,
    savedParameters: preview.runValues, validation: preview.validation,
    simulationSpec: { ...simulation.simulationSpec, solverTimeline: timeline } };
  const stem = fileStem((simulation as { description?: unknown }).description);
  const replay = async () => {
    setBusy(true); setError("");
    try {
      const { offlineReplay } = await import("../engine/offlineReplay");
      downloadFile(stem + "-phat-lai.html", offlineReplay(snapshot, timeline, preview.runValues), "text/html;charset=utf-8");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Không thể xuất mô phỏng."); }
    finally { setBusy(false); }
  };
  const item = "sim-export-menu__item";
  return <>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="sim-action" disabled={busy || preview.recomputing} title="Tải mô phỏng và số liệu về máy">
          <Icon name="download" />{busy ? "Đang xuất…" : "Xuất"}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="sim-export-menu" align="end" sideOffset={6} collisionPadding={8}>
          <DropdownMenu.Item className={item} onSelect={() => downloadFile(stem + ".csv", timelineCsv(timeline), "text/csv;charset=utf-8")}>
            Số liệu theo thời gian (CSV)
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => void replay()}>Trang phát lại ngoại tuyến (HTML, in ra PDF)</DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => downloadFile(stem + ".json", JSON.stringify(snapshot, null, 2), "application/json")}>
            Toàn bộ mô phỏng (JSON)
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    {error && <span role="alert" className="simulation-error">{error}</span>}
  </>;
}
