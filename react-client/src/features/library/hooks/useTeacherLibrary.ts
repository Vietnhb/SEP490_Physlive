import { sessionScope } from "../../../shared/api/queryClient";
import { useApiRefresh } from "../../../shared/hooks/useApiRefresh";
import { useEffect } from "react";
import { create } from "zustand";
import { libraryFolders, personalLibrary } from "../api/libraryApi";
import { getToken } from "../../../shared/lib/token";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import type { LibraryFolder, LibraryItem } from "../../../shared/types/physlive";
import { canTeach } from "../../../shared/auth/permissions";
import { useTopicName } from "../../../shared/hooks/useTopicName";

const librarySession = () => getToken() ? String(sessionScope()) : null;
const FRESH_MS = 60_000;
const emptyFolders: LibraryFolder[] = [];
const emptyItems: LibraryItem[] = [];
type LibraryState = {
  session: string | null;
  folders: LibraryFolder[];
  items: LibraryItem[];
  loading: boolean;
  error: string;
  loadedAt: number;
};
export const teacherLibraryStore = create<LibraryState>(() => ({
  session: null, folders: emptyFolders, items: emptyItems,
  loading: false, error: "", loadedAt: 0,
}));
let pending: { session: string; promise: Promise<void> } | undefined;
window.addEventListener("physlive:session-reset", () => {
  pending = undefined;
  teacherLibraryStore.setState({ session: null, folders: emptyFolders, items: emptyItems, loading: false, error: "", loadedAt: 0 });
});

export function loadTeacherLibrary(force = false): Promise<void> {
  const session = librarySession();
  if (!session) return Promise.resolve();
  if (pending?.session === session) return pending.promise;
  if (teacherLibraryStore.getState().session !== session) {
    teacherLibraryStore.setState({ session, folders: emptyFolders, items: emptyItems, loadedAt: 0, error: "" });
  }
  const before = teacherLibraryStore.getState();
  if (!force && before.loadedAt && Date.now() - before.loadedAt < FRESH_MS) return Promise.resolve();
  teacherLibraryStore.setState({ loading: true, error: "" });
  const request = { session, promise: Promise.resolve() };
  pending = request;
  request.promise = Promise.all([libraryFolders(), personalLibrary()])
    .then(([folders, items]) => {
      if (pending !== request || librarySession() !== session) return;
      const current = teacherLibraryStore.getState();
      teacherLibraryStore.setState({
        // A refresh must not overwrite a folder/item saved while it was in flight.
        folders: current.folders === before.folders ? folders : current.folders,
        items: current.items === before.items ? items : current.items,
        loadedAt: Date.now(),
      });
    })
    .catch(() => {
      if (pending === request && librarySession() === session) teacherLibraryStore.setState({ error: "Chưa tải được thư viện cá nhân." });
    })
    .finally(() => {
      if (pending === request) {
        pending = undefined;
        teacherLibraryStore.setState({ loading: false });
      }
    });
  return request.promise;
}

export function useTeacherLibrary() {
  const topicName = useTopicName();
  const user = useSessionStore(state => state.user);
  const session = librarySession();
  const state = teacherLibraryStore();
  const enabled = Boolean(session) && canTeach(user);
  useEffect(() => {
    if (enabled) void loadTeacherLibrary();
  }, [enabled, session, user?.id]);
  useApiRefresh(["/library"], () => { if (enabled) return loadTeacherLibrary(true); });
  const visible = enabled && state.session === session;
  const update = (patch: Partial<LibraryState>) => {
    if (visible && librarySession() === session) teacherLibraryStore.setState(patch);
  };
  return {
    folders: visible ? state.folders : emptyFolders,
    libraryItems: visible ? state.items : emptyItems,
    libraryLoading: enabled && (!visible || (!state.loadedAt && state.loading)),
    libraryError: visible ? state.error : "",
    retryLibrary: () => { if (enabled) void loadTeacherLibrary(true); },
    topicName,
    setLibraryError: (error: string) => update({ error }),
    setFolders: (change: (folders: LibraryFolder[]) => LibraryFolder[]) => update({ folders: change(teacherLibraryStore.getState().folders) }),
    setLibraryItems: (change: (items: LibraryItem[]) => LibraryItem[]) => update({ items: change(teacherLibraryStore.getState().items) }),
  };
}