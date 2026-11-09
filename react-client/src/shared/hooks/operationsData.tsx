import { useQuery } from "@tanstack/react-query";
import { apiKey, sessionScope } from "../api/queryClient";
import { useRef, useState } from "react";
import axios from "axios";
import api from "../api/client";

export function message(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || "Không thể kết nối máy chủ. Vui lòng thử lại.";
  if (error instanceof Error) return error.message;
  return "Thao tác chưa hoàn tất.";
}

export function useResource<T>(url: string, enabled = true) {
  const result = useQuery<T>({ enabled, queryKey: apiKey(url), placeholderData: (previous, query) => {
    const scope = (value: string) => { const parsed = new URL(value, "https://physlive.local"); parsed.searchParams.delete("page"); parsed.searchParams.delete("size"); return parsed.pathname + parsed.search; };
    return query?.queryKey[1] === sessionScope() && scope(String(query.queryKey[2])) === scope(url) ? previous : undefined;
  }, queryFn: ({ signal }) => api.get<T>(url, { signal }).then(response => response.data) });
  return { data: result.data, error: result.error ? message(result.error) : undefined,
    loading: result.isPending, refreshing: result.isFetching, refresh: () => result.refetch() };
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
