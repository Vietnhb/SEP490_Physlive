import { QueryClient } from "@tanstack/react-query";

// Memory only. A session boundary cancels in-flight work before discarding data.
export const queryClient = new QueryClient({ defaultOptions: {
  queries: { staleTime: 30_000, gcTime: 120_000, retry: false, refetchOnWindowFocus: false },
  mutations: { retry: false },
} });
let generation = 0;
export const sessionScope = () => generation;
export function resetServerState() {
  generation += 1;
  void queryClient.cancelQueries();
  queryClient.clear();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("physlive:session-reset"));
}
export const apiKey = (url: string) => ["api", sessionScope(), url] as const;
export type DataChange = { path?: string };
export function affectedBy(read: string, write?: string) {
  if (!write) return true;
  const schoolId = (path: string) => /\/schools\/([0-9a-f]{8}-[0-9a-f-]{27,})(?:\/|$)/i.exec(path)?.[1]?.toLowerCase();
  const readSchool = schoolId(read), writeSchool = schoolId(write);
  if (readSchool && writeSchool && readSchool !== writeSchool) return false;
  if (/\/(users?|accounts?|appeals?)(\/|$)/.test(write))
    return /\/(users?|accounts?|appeals?|schools|assignments|student|support)(\/|$)|\/admin\/(overview-counts|analytics)(?:\/|$)/.test(read);
  if (/\/schools\/[^/]+\/classes(?:\/|$)/.test(write))
    return /^(?:\/api)?\/schools\/|\/(assignments|student)(?:\/|$)/.test(read);
  if (/\/schools(?:\/|$)/.test(write))
    return /schools|\/user\/me|\/school\/billing|\/admin\/(overview-counts|analytics)|\/assignments|\/student/.test(read);
  if (/\/(support|complaints)(\/|$)/.test(write)) return /support|appeal|complaint|notification/.test(read);
  if (/\/plans(?:\/|$)/.test(write)) return /plans|billing|license|schools/.test(read);
  if (/payments|billing/.test(write)) return /payments|billing|analytics|license|schools/.test(read);
  if (/schemas|curriculum|topics|laws/.test(write)) return /schemas|curriculum|topics|laws|reviewer/.test(read);
  if (/assignments|submissions|grades/.test(write)) return /assignments|student|reports|classes/.test(read);
  if (/library|simulations|problems|evaluations|reviewer/.test(write)) return /library|simulations|problems|evaluations|reviewer|validation|analytics/.test(read);
  return read.split("?")[0] === write.split("?")[0];
}
export function invalidateServerData(path?: string) {
  void queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "api"
    && affectedBy(String(query.queryKey[2]), path) });
  window.dispatchEvent(new CustomEvent<DataChange>("physlive:data-change", { detail: { path } }));
}
