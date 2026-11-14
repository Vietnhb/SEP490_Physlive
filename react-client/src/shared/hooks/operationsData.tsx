import { useQuery } from "@tanstack/react-query";
import { apiKey, queryClient, sessionScope } from "../api/queryClient";
import { useCallback, useRef, useState } from "react";
import axios from "axios";
import api from "../api/client";

export function message(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || "Không thể kết nối máy chủ. Vui lòng thử lại.";
  if (error instanceof Error) return error.message;
  return "Thao tác chưa hoàn tất.";
}

export function useResource<T>(url: string, enabled = true, refreshInterval?: number) {
  const scopeId = sessionScope();
  const result = useQuery<T>({ enabled, refetchInterval: refreshInterval, queryKey: apiKey(url), placeholderData: (previous, query) => {
    const scope = (value: string) => { const parsed = new URL(value, "https://physlive.local"); parsed.searchParams.delete("page"); parsed.searchParams.delete("size"); return parsed.pathname + parsed.search; };
    return query?.queryKey[1] === sessionScope() && scope(String(query.queryKey[2])) === scope(url) ? previous : undefined;
  }, queryFn: ({ signal }) => api.get<T>(url, { signal }).then(response => response.data) });
  const accessDenied = axios.isAxiosError(result.error) && [401, 403, 404].includes(result.error.response?.status ?? 0);
  const refetch = result.refetch;
  const refresh = useCallback(() => refetch(), [refetch]);
  const setData = useCallback((value: T | ((previous: T) => T)) => {
    if (scopeId !== sessionScope()) return;
    queryClient.setQueryData<T>(["api", scopeId, url], previous =>
      typeof value === "function" ? previous === undefined ? undefined : (value as (previous: T) => T)(previous) : value);
  }, [url, scopeId]);
  return { data: accessDenied ? undefined : result.data, setData, error: result.error ? message(result.error) : undefined,
    loading: result.isPending, refreshing: result.isFetching, refresh };
}

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>, success = "Đã lưu thay đổi.") => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); setNotice(success); return true; }
    catch (exception) { setError(message(exception)); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  return { busy, run, feedback: <>{error && <div className="ops-alert" role="alert">{error}</div>}{notice && <output className="ops-success">{notice}</output>}</> };
}
