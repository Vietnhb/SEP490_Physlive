import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PageActionsSlot } from "./PageActionsContext";

/**
 * A page's main actions (add, create, refresh). Inside an area with a top bar they sit in that bar, on the breadcrumb's
 * row, so the page needs no header row of its own; elsewhere they stay where the page puts them.
 */
export default function PageActions({ children }: Readonly<{ children: ReactNode }>) {
  const slot = useContext(PageActionsSlot);
  if (!children) return null;
  return slot ? createPortal(children, slot) : <>{children}</>;
}
