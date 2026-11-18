import { createContext, useContext } from "react";

/** The place in the area's top bar, beside the breadcrumb, where the open page puts its main actions. */
export const PageActionsSlot = createContext<HTMLElement | null>(null);

/** Whether the page is shown inside an area whose top bar can hold its actions. */
export function usePageActionsInTopbar() {
  return useContext(PageActionsSlot) !== null;
}
