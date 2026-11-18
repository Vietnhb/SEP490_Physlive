import { useEffect, useRef, useState } from "react";

/**
 * Names a page for screen readers (and the browser tab) when the page itself shows no main heading. Placed inside the
 * page's content area; it steps aside as soon as the content renders an h1 of its own.
 */
export default function FallbackHeading({ title }: Readonly<{ title: string }>) {
  const marker = useRef<HTMLSpanElement>(null);
  const [needed, setNeeded] = useState(false);
  useEffect(() => {
    const area = marker.current?.parentElement;
    if (!area) return;
    const check = () => setNeeded(!area.querySelector("h1:not([data-fallback-heading])"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(area, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <>
    <span ref={marker} hidden />
    {needed && <h1 className="sr-only" data-fallback-heading>{title}</h1>}
  </>;
}
