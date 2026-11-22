import { useState, type ReactNode } from "react";
import { PageActionsSlot, PageActionsTargetRegistration } from "./PageActionsContext";
export default function PageActionsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  return <PageActionsTargetRegistration.Provider value={setTarget}><PageActionsSlot.Provider value={target}>{children}</PageActionsSlot.Provider></PageActionsTargetRegistration.Provider>;
}
