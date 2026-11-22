import { useContext } from "react";
import { PageActionsTargetRegistration } from "./PageActionsContext";
export default function PageActionsTarget() {
  const register = useContext(PageActionsTargetRegistration);
  return register ? <div ref={register} className="page-refresh-actions" data-page-actions-target /> : null;
}
