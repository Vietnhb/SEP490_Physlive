import type { SimulationValidation } from "../api/simulationUnderstandingApi";
import MathFormula from "../../../shared/ui/MathFormula";
import { legend, letterTex, relation, relationTex } from "../model/lawFormula";

type Check = NonNullable<SimulationValidation["lawChecks"]>[number];

const unitText = (unit: string) => unit.replaceAll(/([A-Za-zµΩ])\^?([23])(?![0-9])/g, (_, base: string, power: string) => base + (power === "2" ? "²" : "³"));
const percent = (value: number) => value * 100 < 0.01 ? "< 0,01%" : `${(value * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`;

/**
 * The laws a run was checked against, each with its evidence: the relation tested, what its letters stood for in this
 * simulation, at how many instants it was computed and how far the two sides drifted apart at worst.
 */
export default function LawCheckList({ checks, labelOf }: Readonly<{ checks: Check[]; labelOf: (id: string) => string | undefined }>) {
  // one law checked for several objects or axes is one entry: every place it was tested, the worst gap among them
  const groups = [...checks.reduce((map, check) => map.set(check.title, [...(map.get(check.title) ?? []), check]), new Map<string, Check[]>()).values()];
  return <ul className="law-checks">{groups.map(group => {
    const first = group.find(check => check.relation) ?? group[0];
    const status = group.some(check => check.status === "FAILED") ? "FAILED" : group.some(check => check.status === "AMBIGUOUS") ? "AMBIGUOUS" : "PASSED";
    const formula = relation(first.relationKind, first.relation);
    const formulaTex = relationTex(first.relationKind, first.relation);
    const letters = legend(first.symbols, labelOf);
    const samples = group.reduce((sum, check) => sum + (check.samples ?? 0), 0);
    const measured = group.some(check => check.relativeDeviation != null);
    const worst = Math.max(...group.map(check => check.relativeDeviation ?? 0));
    const tolerance = first.tolerance;
    const failure = group.find(check => check.status === "FAILED" && check.message)?.message;
    return <li key={first.law + first.title} className={"law-check is-" + status.toLowerCase()}>
      <span className="law-check__mark" aria-label={status === "PASSED" ? "Thoả" : status === "FAILED" ? "Không thoả" : "Chưa xác định"}>{status === "PASSED" ? "✓" : status === "FAILED" ? "✗" : "?"}</span>
      <div className="law-check__body">
        <b>{first.title}</b>
        {formulaTex && <span className="law-check__formula" title={formula ?? undefined}><MathFormula latex={formulaTex} /></span>}
        {letters.length > 0 && <p className="law-check__legend">{letters.map((entry, index) => <span key={entry.letter + index}>
          <MathFormula latex={letterTex(entry.name)} />{entry.many ? " (cộng các đại lượng)" : ""}: {entry.quantities.map(quantity => quantity.label + (quantity.unit ? ` (${unitText(quantity.unit)})` : "")).join("; ")}</span>)}</p>}
        {status === "AMBIGUOUS" && <p className="law-check__evidence">Chưa xác định được đại lượng nào để đối chiếu.</p>}
        {(samples > 0 || measured) && status !== "AMBIGUOUS" && <p className="law-check__evidence">{samples > 0 ? `Tính hai vế tại ${samples.toLocaleString("vi-VN")} thời điểm · ` : "Tính hai vế suốt quá trình chạy · "}{group.length > 1 ? `ở ${group.length} phạm vi · ` : ""}lệch lớn nhất {percent(worst)}{tolerance != null ? ` (cho phép ${percent(tolerance)})` : ""}</p>}
        {failure && <p className="law-check__evidence is-failed">{failure}</p>}
        {first.curriculum && <small className="law-check__curriculum">{first.curriculum}</small>}
      </div>
    </li>;
  })}</ul>;
}
