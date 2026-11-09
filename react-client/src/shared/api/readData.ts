import api from "./client";
import { apiKey, queryClient } from "./queryClient";

/** Share data, not Axios responses (which contain authorization headers). */
export function readData<T>(url: string, staleTime = 30_000): Promise<T> {
  return queryClient.fetchQuery({ queryKey: apiKey(url), staleTime,
    queryFn: ({ signal }) => api.get<T>(url, { signal }).then(response => response.data) });
}
