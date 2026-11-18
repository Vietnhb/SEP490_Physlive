import { useCallback, useEffect, useState } from "react";

type NamedPlan = { code: string; name: string };

/**
 * The name each plan is sold under, read from the plan catalogue; a plan the catalogue no longer lists keeps its code.
 * `source` must be a stable function (a module-level API call).
 */
export function usePlanNames(source: () => Promise<NamedPlan[]>) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    source()
      .then(plans => { if (active) setNames(Object.fromEntries(plans.map(plan => [plan.code, plan.name]))); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [source]);
  return useCallback((code?: string | null) => (code ? names[code] || code : ""), [names]);
}
