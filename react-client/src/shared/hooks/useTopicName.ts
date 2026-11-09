import { useMemo } from "react";
import { useResource } from "./operationsData";

type TopicSchema = { topic?: string | null; name?: string | null; lifecycleStatus?: string | null };
export function useTopicName() {
  const { data } = useResource<TopicSchema[]>("/schemas");
  const names = useMemo(() => {
    const result = new Map<string, string>();
    const rows = [...(data ?? [])].sort((a, b) => Number(b.lifecycleStatus === "APPROVED") - Number(a.lifecycleStatus === "APPROVED"));
    for (const row of rows) if (row.topic && row.name && !result.has(row.topic)) result.set(row.topic, row.name);
    return result;
  }, [data]);
  return (code?: string | null) => !code ? "" : names.get(code) ?? code;
}
