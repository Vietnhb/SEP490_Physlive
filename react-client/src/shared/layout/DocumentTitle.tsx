import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_TITLE = "PhysLive — Phòng thí nghiệm Vật lý số";

/** The words of a heading as a screen reader reads them: decorative copies (aria-hidden) are left out. */
function readableText(element: Element) {
  let text = "";
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest("[aria-hidden='true']")) text += node.textContent ?? "";
  }
  return text.replaceAll(/\s+/g, " ").trim();
}

/** Keeps the browser tab named after the page being shown, so tabs and history can be told apart. */
export default function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // the page name in the area's breadcrumb when there is one (a dashboard's heading is a greeting), else its heading
      // a page can name itself; an empty name means a home page, whose tab is simply the product name
      const named = document.querySelector("[data-page-title]")?.getAttribute("data-page-title");
      if (named != null) {
        const titled = named.trim() ? `${named.trim()} · PhysLive` : "PhysLive";
        if (document.title !== titled) document.title = titled;
        return;
      }
      const crumbs = document.querySelectorAll(".app-topbar__title strong");
      const heading = pathname === "/" ? null : crumbs[crumbs.length - 1] ?? document.querySelector("main h1, h1");
      const name = heading ? readableText(heading) : "";
      const next = name ? `${name} · PhysLive` : SITE_TITLE;
      if (document.title !== next) document.title = next;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    // pages load their heading after their data; follow it, at most once per frame
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [pathname]);
  return null;
}
