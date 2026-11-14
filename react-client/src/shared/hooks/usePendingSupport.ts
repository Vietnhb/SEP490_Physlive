import { useEffect, useRef } from "react";
import { useResource } from "./operationsData";
import { queryClient } from "../api/queryClient";

/** SSE refreshes immediately; polling also reconciles the inbox when an event was missed. */
export function usePendingSupport(enabled = true) {
  const result = useResource<{ count: number; revision?: number }>("/support/inbox/pending-count", enabled, 5_000);
  const previous = useRef<string | null>(null);
  const count = result.data?.count, revision = result.data?.revision;
  useEffect(() => {
    if (!enabled || count === undefined) return;
    const marker = `${revision ?? ""}:${count}`;
    if (previous.current === marker) return;
    const initial = previous.current === null;
    previous.current = marker;
    if (initial) return;
    // Never invalidate the pending-count query itself, or this would create a refetch loop.
    void queryClient.invalidateQueries({ predicate: query => {
      const path = String(query.queryKey[2]).split("?")[0];
      return query.queryKey[0] === "api" && (path === "/support/inbox" || path === "/admin/appeals");
    } });
  }, [enabled, count, revision]);
  return result.data?.count ?? 0;
}
