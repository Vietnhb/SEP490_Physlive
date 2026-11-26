import { useLayoutEffect, useState } from "react";

/**
 * A container for canvas dialogs at the top of the studio shell. Pages sit inside a themed wrapper that is its own
 * stacking context, so a dialog rendered there stays under the sticky top bar; this one lives beside the shell
 * instead and still carries the .page class the canvas dialog styles are written under.
 */
export function useStudioPortal(anchor: HTMLElement | null) {
  const [node] = useState(() => {
    const element = document.createElement("div");
    element.className = "page page-portal";
    return element;
  });
  // a layout effect: the container is in place before a dialog inside it moves focus (dialogs focus in a passive effect)
  useLayoutEffect(() => {
    const root = anchor?.closest(".studio-root");
    if (!root) return;
    root.appendChild(node);
    return () => node.remove();
  }, [anchor, node]);
  return node;
}
