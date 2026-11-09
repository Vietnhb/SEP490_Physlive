import { useEffect, useRef } from "react";
import { affectedBy, type DataChange } from "../api/queryClient";

/** Refresh legacy screens without unmounting editors, forms or running scenes. */
export function useApiRefresh(paths: string[], refresh: () => unknown) {
  const latest = useRef({ paths, refresh });
  useEffect(() => { latest.current = { paths, refresh }; });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = (event: Event) => {
      const path = (event as CustomEvent<DataChange>).detail?.path;
      if (!latest.current.paths.some(read => affectedBy(read, path))) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void latest.current.refresh(); }, 150);
    };
    window.addEventListener("physlive:data-change", changed);
    return () => { clearTimeout(timer); window.removeEventListener("physlive:data-change", changed); };
  }, []);
}
