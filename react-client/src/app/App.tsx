import { sessionScope } from "../shared/api/queryClient";
import { useEffect } from "react";
import AppRoutes from "./AppRoutes";
import DocumentTitle from "../shared/layout/DocumentTitle";
import AppShell from "./AppShell";
import { useSessionBootstrap } from "./useSessionBootstrap";
import { useSessionStore } from "../shared/auth/sessionStore";
import { useRealtimeRevision } from "./hooks/useRealtimeRevision";
import { isAccountSuspended } from "../shared/auth/permissions";
import { getMe } from "../features/account/api/userApi";

export default function App() {
  const authReady = useSessionBootstrap();
  const user = useSessionStore(state => state.user);
  const setUser = useSessionStore(state => state.setUser);
  const hasUser = user !== null;
  const realtimeRevision = useRealtimeRevision(authReady && hasUser && !user?.mustChangePassword && !isAccountSuspended(user));
  useEffect(() => {
    if (realtimeRevision === 0 || !hasUser) return;
    let active = true;
    void getMe().then(latest => { if (active) setUser(latest); }).catch(() => undefined);
    return () => { active = false; };
  }, [hasUser, realtimeRevision, setUser]);
  return (
    <AppShell key={sessionScope()}>
      <DocumentTitle />
      <AppRoutes authReady={authReady} />
    </AppShell>
  );
}
